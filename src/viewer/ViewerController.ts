import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import type { Camera } from 'molstar/lib/mol-canvas3d/camera';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { StructureElement, StructureProperties, Bond } from 'molstar/lib/mol-model/structure';
import { neighborhoodSearch, visibleSubset } from './visibleAtoms';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { ButtonsType } from 'molstar/lib/mol-util/input/input-observer';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { bestView } from './bestView';
import { Mat4, Vec3, Vec4 } from 'molstar/lib/mol-math/linear-algebra';
import { extractAlignmentChains, fitChains, residueKey } from './alignment';
import type { AlignmentRequest, AlignmentReport } from './alignment';
import { examplePath } from './examples';
import { createViewer } from './createViewer';
import { detectFormat, loadStructure } from './structureLoader';
import { residueFromLoci } from './selection';
import { chainColors, renderPart } from './representations';
import { colorHex } from './palettes';
import { applyVisualPreset } from './visualPresets';
import { fetchStructure, rcsbId } from './sources';
import type { BiomolViewer, SelectionState, SceneStructure, Palette, RepresentationMode, VisualPreset, ColorMapping, AnnotationKind, StructureAnnotation, ResidueRef, MeasurementResult, AutoAnnotationMode, GalleryOptions, SavedFile, VideoOptions } from './types';
import { parseScalarMapping, setScalarMapping, type ScalarRecord } from './customColorTheme';
import { geometryPocketResidues, interfaceArea, interfaceResidues, measurePoints, selectedAnchorPoints, sequenceResidues, sourceDefinedSites } from './analysis';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { Color } from 'molstar/lib/mol-util/color';
import { randomId } from './randomId';
type Loaded = Awaited<ReturnType<typeof loadStructure>>;
type AnnotationEntry = { state: StructureAnnotation; node: Loaded['structure'] };
interface SessionSnapshot { version:1; style:{palette:Palette;mode:RepresentationMode;preset:VisualPreset;colorMapping:ColorMapping;customScalar?:ScalarRecord[];labels:boolean}; camera?:Camera.Snapshot; structures:{name:string;sourceText:string;matrix:number[];visible:boolean;parts:{id:string;visible:boolean}[];annotations:StructureAnnotation[]}[]; }
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
function rotateVector(out:Vec3,v:Vec3,axis:Vec3,angle:number){const c=Math.cos(angle),s=Math.sin(angle),cross=Vec3.cross(Vec3(),axis,v);Vec3.scale(out,v,c);Vec3.scaleAndAdd(out,out,cross,s);Vec3.scaleAndAdd(out,out,axis,Vec3.dot(axis,v)*(1-c));return out;}
export class ViewerController implements BiomolViewer {
  private entries = new Map<string, Loaded & { visible: boolean; macFile?: string; matrix: Mat4; annotations: AnnotationEntry[] }>();
  private previousView?: Camera.Snapshot;
  private preview?: { id: string; matrix: Mat4; camera?: Camera.Snapshot; restoreAlpha: (()=>void)[] };
  private addSelection = false;
  private colorSerial = 0;
  private undo: { id: string; matrix: Mat4 }[] = [];
  private lastAlignment?: { request: AlignmentRequest; report: AlignmentReport };
  private selection: SelectionState = { residues: [] };
  private selectedLoci?: StructureElement.Loci;
  private detailRefs: string[] = [];
  private picking: 'residue' | 'atom' = 'residue';
  private palette: Palette = 'vivid';
  private mode: RepresentationMode = 'cartoon';
  private visualPreset: VisualPreset = 'default';
  private colorMapping: ColorMapping = 'chain';
  private customScalar?: ScalarRecord[];
  private labelsVisible = false;
  private labelLayer?: HTMLDivElement;
  private drawSubscription;
  private listeners = new Set<(selection: SelectionState) => void>();
  private clickSubscription;
  private disposed = false;
  private pending?: Promise<unknown>;
  private abort = new AbortController();
  private constructor(private plugin: PluginContext, private observer: ResizeObserver, private host: HTMLDivElement) {
    if (typeof document !== 'undefined' && host.appendChild) {
      this.labelLayer = document.createElement('div');
      this.labelLayer.className = 'chain-label-layer';
      this.labelLayer.setAttribute('aria-hidden', 'true');
      host.appendChild(this.labelLayer);
    }
    this.drawSubscription = plugin.canvas3d?.didDraw.subscribe(() => this.updateChainLabels());
    plugin.managers.interactivity.setProps({ granularity: 'residue' });
    this.clickSubscription = plugin.behaviors.interaction.click.subscribe(event => {
      if (this.disposed || this.pending || this.preview || event.button !== ButtonsType.Flag.Primary) return;
      const raw = Bond.isLoci(event.current.loci) ? Bond.toFirstStructureElementLoci(event.current.loci) : event.current.loci;
      const picked = residueFromLoci(raw);
      if (!picked) return;
      const entry = [...this.entries.entries()].find(([, item]) => item.structure.obj?.data.root === picked.loci.structure.root);
      if (!entry) return;
      picked.loci = StructureElement.Loci.remap(picked.loci, entry[1].structure.obj!.data);
      if (this.picking === 'atom' && (!StructureElement.Loci.is(raw) || StructureElement.Loci.size(raw) !== 1)) return;
      if (this.addSelection && this.picking === 'residue') {
        const same = this.selection.structureId === entry[0];
        const residues = same ? [...this.selection.residues] : [];
        const index = residues.findIndex(r => residueKey(r) === residueKey(picked.residue));
        if (index >= 0) {
          residues.splice(index, 1); plugin.managers.interactivity.lociSelects.deselect({ loci: picked.loci }, false);
          if (this.selectedLoci) this.selectedLoci = StructureElement.Loci.subtract(this.selectedLoci, picked.loci);
        } else {
          if (!same) this.clearSelection();
          residues.push(picked.residue); plugin.managers.interactivity.lociSelects.select({ loci: picked.loci }, false);
          this.selectedLoci = same && this.selectedLoci ? StructureElement.Loci.union(this.selectedLoci, picked.loci) : picked.loci;
        }
        this.selection = { residues, structureId: entry[0], fileName: entry[1].metadata.fileName }; this.emitSelection(); return;
      }
      this.selectedLoci = this.picking === 'atom' && StructureElement.Loci.is(raw) ? StructureElement.Loci.remap(raw, entry[1].structure.obj!.data) : picked.loci;
      plugin.managers.interactivity.lociSelects.selectOnly({ loci: this.selectedLoci }, false);
      const location = StructureElement.Loci.getFirstLocation(this.selectedLoci);
      this.selection = { residues: [picked.residue], structureId: entry[0], fileName: entry[1].metadata.fileName, ...(this.picking === 'atom' && location ? { atomName: StructureProperties.atom.label_atom_id(location) } : {}) };
      this.emitSelection();
    });
  }
  static async create(host: HTMLDivElement, signal: AbortSignal): Promise<BiomolViewer> {
    const plugin = await createViewer(host, signal);
    const observer = new ResizeObserver(() => plugin.handleResize());
    observer.observe(host);
    return new ViewerController(plugin, observer, host);
  }
  getSelection(): SelectionState { return { ...this.selection, residues: this.selection.residues.map(r => ({ ...r })) }; }
  subscribeSelection(callback: (selection: SelectionState) => void) { this.listeners.add(callback); callback(this.getSelection()); return () => { this.listeners.delete(callback); }; }
  private emitSelection() { for (const listener of this.listeners) listener(this.getSelection()); }
  private hideDetail() {
    this.detailRefs=this.detailRefs.filter(ref=>this.plugin.state.data.cells.has(ref));
    for(const ref of this.detailRefs)setSubtreeVisibility(this.plugin.state.data,ref,true);
    if(this.selection.neighborhood){delete this.selection.neighborhood;this.emitSelection();}
  }
  clearSelection(hideDetail = true) {
    if (this.disposed) return;
    if (hideDetail) this.hideDetail();
    this.plugin.managers.interactivity.lociSelects.deselectAll();
    this.selection = { residues: [] }; this.selectedLoci = undefined; this.emitSelection();
  }
  private run<T>(work: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new Error('Viewer is closed.'));
    if (this.preview) return Promise.reject(new Error('Release the alignment preview first.'));
    if (this.pending) return Promise.reject(new Error('A structure is already loading or updating.'));
    const task = work(); this.pending = task;
    void task.then(() => { this.pending = undefined; }, () => { this.pending = undefined; });
    return task;
  }
  private runLoad(read: () => Promise<File>, macFile?: string, replaceId?: string) {
    return this.run(async () => {
      const file = await read();
      const format = detectFormat(file.name);
      const text = await file.text(); this.abort.signal.throwIfAborted();
      const offset = this.colorSerial;
      const loaded = await loadStructure(this.plugin, text, file.name, format, this.palette, this.mode, offset, this.visualPreset, this.colorMapping === 'custom' ? 'chain' : this.colorMapping);
      if (!this.disposed) {
        if (this.colorMapping === 'custom' && this.customScalar && loaded.structure.obj) {
          setScalarMapping(loaded.structure.obj.data, this.customScalar);
          for (const part of loaded.parts) { const tree=this.plugin.build();this.plugin.state.data.tree.children.get(part.node.ref)?.forEach(ref=>tree.delete(ref));await tree.commit();await renderPart(this.plugin,part,this.mode,this.visualPreset,'custom'); }
        }
        this.colorSerial += loaded.parts.filter(part => part.protein).length;
        this.clearSelection();
        const previous = replaceId ? this.entries.get(replaceId) : undefined;
        if (previous) {
          for (const part of loaded.parts) part.state.visible = previous.parts.find(p => p.state.id === part.state.id)?.state.visible ?? part.state.visible;
          await this.plugin.build().delete(replaceId!).commit(); this.entries.delete(replaceId!); this.undo=this.undo.filter(u=>u.id!==replaceId); this.lastAlignment=undefined;
        }
        this.entries.set(loaded.dataRef, { ...loaded, visible: previous?.visible ?? true, macFile, matrix: Mat4.identity(), annotations: [] });
        this.applyVisibility(loaded.dataRef);
        this.focusStructure(loaded.dataRef);
      }
      return loaded.metadata;
    });
  }
  loadFile(file: File) { return this.runLoad(async () => file); }
  loadExample(id?: string) { return this.runLoad(() => fetchStructure(id ? examplePath(id) : `${import.meta.env.BASE_URL}examples/example.cif`, id ? `${id}.cif` : 'Crambin · 1CRN.cif', this.abort.signal)); }
  loadRcsb(input: string) { return this.runLoad(() => { const id = rcsbId(input); return fetchStructure(`https://files.rcsb.org/download/${id}.cif`, `${id}.cif`, this.abort.signal); }); }
  loadMacFile(name: string) { return this.runLoad(() => fetchStructure(`/api/library/file?name=${encodeURIComponent(name)}`, name, this.abort.signal), name); }
  reloadMacStructure(id: string) {
    const name = this.entries.get(id)?.macFile;
    if (!name) return Promise.reject(new Error('This structure is not from the Mac library.'));
    return this.runLoad(() => fetchStructure(`/api/library/file?name=${encodeURIComponent(name)}`, name, this.abort.signal), name, id);
  }
  duplicateStructure(id: string) {
    const entry = this.entries.get(id); if (!entry) return Promise.reject(new Error('Structure is no longer open.'));
    return this.loadFile(new File([entry.sourceText], `Copy of ${entry.metadata.fileName}`));
  }
  setSelectionMode(add: boolean) { this.addSelection = add; if (add) this.picking = 'residue'; }
  private alignmentInput(request: AlignmentRequest) {
    if (request.reference.structureId === request.mobile.structureId) throw new Error('Choose two structure instances. Duplicate the file to compare its chains without moving the reference.');
    const get = (side: AlignmentRequest['reference']) => {
      const entry = this.entries.get(side.structureId);
      if (!entry?.structure.obj) throw new Error('An alignment structure is no longer open.');
      const chain = extractAlignmentChains(entry.structure.obj.data).find(c => c.chainId === side.chainId);
      if (!chain) throw new Error('Choose an available polymer chain.');
      return chain;
    };
    return [get(request.reference), get(request.mobile)] as const;
  }
  previewAlignment(request: AlignmentRequest) { const [a,b] = this.alignmentInput(request); return fitChains(a,b,request); }
  beginAlignmentPreview(request: AlignmentRequest) { return this.run(async()=>{
    const report=this.previewAlignment(request), entry=this.entries.get(request.mobile.structureId)!;
    const snapshot={id:request.mobile.structureId,matrix:Mat4.clone(entry.matrix),camera:this.plugin.canvas3d?.camera.getSnapshot(),restoreAlpha:[] as (()=>void)[]};
    this.preview=snapshot;
    try {
      const next=Mat4.mul(Mat4(),Mat4.fromArray(Mat4(),report.matrix,0),entry.matrix);
      await this.plugin.build().to(entry.structure).update({transform:{name:'matrix',params:{data:next,transpose:false}}}).commit();
      for(const cell of this.plugin.state.data.cells.values()){
        if(!PluginStateObject.Molecule.Structure.Representation3D.is(cell.obj))continue;
        let ref=cell.transform.parent;
        while(ref && ref!==request.mobile.structureId && ref!==request.reference.structureId){const parent=this.plugin.state.data.cells.get(ref)?.transform.parent;if(parent===ref)break;ref=parent || '';}
        if(ref!==request.mobile.structureId && ref!==request.reference.structureId)continue;
        const repr=cell.obj.data.repr,alpha=repr.state.alphaFactor;
        snapshot.restoreAlpha.push(()=>repr.setState({alphaFactor:alpha}));repr.setState({alphaFactor:0.45});
      }
      this.plugin.canvas3d?.requestDraw();
      this.plugin.managers.camera.focusSphere(this.entries.get(request.reference.structureId)!.structure.obj!.data.boundary.sphere,{durationMs:0});
      return report;
    } catch(error){await this.restorePreview();throw error;}
  }); }
  private async restorePreview(){
    const snapshot=this.preview;if(!snapshot)return;
    try {
      const entry=this.entries.get(snapshot.id);
      if(entry)await this.plugin.build().to(entry.structure).update({transform:{name:'matrix',params:{data:snapshot.matrix,transpose:false}}}).commit();
    } finally {
      snapshot.restoreAlpha.forEach(restore=>restore());
      if(snapshot.camera)this.plugin.managers.camera.setSnapshot(snapshot.camera,0);
      this.plugin.canvas3d?.requestDraw();this.preview=undefined;
    }
  }
  async endAlignmentPreview(){
    if(this.pending)await this.pending.catch(()=>{});
    await this.restorePreview();
  }
  quickAlign(){return this.run(async()=>{
    if(this.entries.size!==2)throw new Error('Quick align requires exactly two open files.');
    const [reference,mobile]=[...this.entries];
    const a=extractAlignmentChains(reference[1].structure.obj!.data),b=extractAlignmentChains(mobile[1].structure.obj!.data);
    const candidates=a.flatMap(x=>b.filter(y=>y.kind===x.kind && x.anchors.length>=3 && y.anchors.length>=3).map(y=>[x,y] as const));
    if(!candidates.length)throw new Error('No compatible polymer chain pair is available.');
    if(candidates.length>32)throw new Error('More than 32 compatible chain pairs. Choose chains in Align to keep the search responsive.');
    if(candidates.some(([x,y])=>x.anchors.length*y.anchors.length>500_000))throw new Error('A chain pair exceeds the coordinate search limit. Choose smaller regions in Align.');
    let best:{request:AlignmentRequest;report:AlignmentReport;candidates:number}|undefined;
    const scores:number[]=[];
    // Yield between candidates so the iPad can paint its progress state.
    for(const [x,y] of candidates){
      await new Promise(resolve=>setTimeout(resolve,0));
      const request:AlignmentRequest={reference:{structureId:reference[0],chainId:x.chainId},mobile:{structureId:mobile[0],chainId:y.chainId},pairing:'coordinates'};
      try{const report=this.previewAlignment(request);scores.push(report.coordinateScore!);if(!best || report.coordinateScore!>best.report.coordinateScore!)best={request,report,candidates:candidates.length};}catch{/* Degenerate chains cannot define a rigid fit. */}
    }
    if(!best)throw new Error('No valid chain fit found. Choose chains or regions manually.');
    best.report=await this.commitAlignment(best.request);
    if(scores.filter(score=>best!.report.coordinateScore!-score<0.02).length>1)best.report.warnings.push('Several chain pairs have similar geometry scores; the first best-scoring pair was used. Inspect the match.');
    return best;
  });}
  purge(){return this.run(async()=>{
    this.clearSelection();const update=this.plugin.build();for(const id of this.entries.keys())update.delete(id);await update.commit();
    this.entries.clear();this.previousView=undefined;this.undo=[];this.lastAlignment=undefined;this.detailRefs=[];this.addSelection=false;this.colorSerial=0;this.updateChainLabels();this.resetCamera();
  });}
  applyAlignment(request: AlignmentRequest) { return this.run(()=>this.commitAlignment(request)); }
  private async commitAlignment(request: AlignmentRequest) {
    const report = this.previewAlignment(request);
    const entry = this.entries.get(request.mobile.structureId)!;
    const previous = Mat4.clone(entry.matrix);
    const next = Mat4.mul(Mat4(), Mat4.fromArray(Mat4(), report.matrix, 0), entry.matrix);
    this.clearSelection();
    await this.plugin.build().to(entry.structure).update({ transform: { name: 'matrix', params: { data: next, transpose: false } } }).commit();
    entry.matrix = next; this.undo.push({ id: request.mobile.structureId, matrix: previous });
    if (this.undo.length > 20) this.undo.shift();
    this.lastAlignment = { request: structuredClone(request), report };
    this.applyVisibility(request.mobile.structureId); this.resetCamera();
    return report;
  }
  undoAlignment() { return this.run(async () => {
    const last = this.undo.at(-1); if (!last) throw new Error('No alignment to undo.');
    const entry = this.entries.get(last.id);
    if (!entry) { this.undo.pop(); throw new Error('The moved structure was removed or reloaded.'); }
    this.clearSelection();
    await this.plugin.build().to(entry.structure).update({ transform: { name: 'matrix', params: { data: last.matrix, transpose: false } } }).commit();
    entry.matrix = last.matrix; this.undo.pop(); this.lastAlignment = undefined; this.applyVisibility(last.id); this.resetCamera();
  }); }
  exportImage(transparent: boolean) { return this.run(async () => {
    if (!this.entries.size) throw new Error('Open a structure before exporting.');
    const helper = this.plugin.helpers.viewportScreenshot;
    if (!helper) throw new Error('Image export is unavailable.');
    const previous = helper.values;
    let image: string;
    try {
      helper.behaviors.values.next({ ...previous, transparent, format: { name: 'png', params: {} }, resolution: { name: 'viewport', params: {} } });
      image = await helper.getImageDataUri();
    } finally { helper.behaviors.values.next(previous); }
    const response = await fetch('/api/exports', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Biomol-Export': '1' }, body: JSON.stringify({ image, manifest: { version: 1, created: new Date().toISOString(), transparent, style: { palette: this.palette, representation: this.mode, visualPreset: this.visualPreset, colorMapping: this.colorMapping, chainLabels: this.labelsVisible }, scene: this.getScene(), transforms: [...this.entries].map(([id,e]) => ({ id, matrix: Array.from(e.matrix) })), camera: this.plugin.canvas3d?.camera.getSnapshot(), alignment: this.lastAlignment } }), signal: this.abort.signal });
    if (!response.ok) throw new Error('Could not save the image on the Mac. Check the export folder and server.');
    return await response.json() as { name: string; url: string; metadataUrl: string };
  }); }
  private sessionSnapshot():SessionSnapshot{return{version:1,style:{palette:this.palette,mode:this.mode,preset:this.visualPreset,colorMapping:this.colorMapping,customScalar:this.customScalar?structuredClone(this.customScalar):undefined,labels:this.labelsVisible},camera:this.plugin.canvas3d?.camera.getSnapshot(),structures:[...this.entries.values()].map(entry=>({name:entry.metadata.fileName,sourceText:entry.sourceText,matrix:Array.from(entry.matrix),visible:entry.visible,parts:entry.parts.map(p=>({id:p.state.id,visible:p.state.visible})),annotations:entry.annotations.map(a=>structuredClone(a.state))}))};}
  createSharedSession(){return this.run(async()=>{if(!this.entries.size)throw new Error('Open a structure before sharing.');const response=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json','X-Biomol-Session':'1'},body:JSON.stringify(this.sessionSnapshot()),signal:this.abort.signal});if(!response.ok)throw new Error('Could not save this session on the Mac.');const result=await response.json() as {id:string;path:string;networkOrigins:string[]};const local=!['localhost','127.0.0.1'].includes(location.hostname),origin=local?location.origin:result.networkOrigins[0]||location.origin;return{id:result.id,url:`${origin}${result.path}`};});}
  async loadSharedSession(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('This shared-session URL is invalid.');const response=await fetch(`/api/sessions/${id}`,{signal:this.abort.signal});if(!response.ok)throw new Error('This shared session is unavailable.');const data=await response.json() as SessionSnapshot;if(data.version!==1||!Array.isArray(data.structures)||!data.structures.length)throw new Error('This shared session is invalid.');await this.purge();this.palette=data.style.palette;this.mode=data.style.mode;this.visualPreset=data.style.preset;this.colorMapping=data.style.colorMapping;this.customScalar=data.style.customScalar;this.labelsVisible=data.style.labels;applyVisualPreset(this.plugin,this.visualPreset);
    for(const saved of data.structures){await this.loadFile(new File([saved.sourceText],saved.name));const pair=[...this.entries].at(-1);if(!pair)continue;const [entryId,entry]=pair;await this.run(async()=>{if(saved.matrix?.length===16){const matrix=Mat4.fromArray(Mat4(),saved.matrix,0);await this.plugin.build().to(entry.structure).update({transform:{name:'matrix',params:{data:matrix,transpose:false}}}).commit();entry.matrix=matrix;}entry.visible=saved.visible;for(const part of entry.parts)part.state.visible=saved.parts.find(p=>p.id===part.state.id)?.visible??part.state.visible;this.applyVisibility(entryId);});for(const annotation of saved.annotations||[]){const loci=this.lociForResidues(entryId,annotation.residues);if(loci&&!StructureElement.Loci.isEmpty(loci))await this.addAnnotationLoci(entryId,loci,annotation.kind,annotation.name,annotation.color);}}
    if(data.camera)this.plugin.managers.camera.setSnapshot(data.camera,0);this.updateChainLabels();return{palette:this.palette,mode:this.mode,preset:this.visualPreset,colorMapping:this.colorMapping,labels:this.labelsVisible};}
  private async captureImage(transparent:boolean){const helper=this.plugin.helpers.viewportScreenshot;if(!helper)throw new Error('Image export is unavailable.');const previous=helper.values;try{helper.behaviors.values.next({...previous,transparent,format:{name:'png',params:{}},resolution:{name:'viewport',params:{}}});return await helper.getImageDataUri();}finally{helper.behaviors.values.next(previous);}}
  recordVideo(options:VideoOptions){return this.run(async()=>{if(!this.entries.size)throw new Error('Open structures before recording.');const canvas=this.host.querySelector('canvas');if(!canvas||typeof canvas.captureStream!=='function'||typeof MediaRecorder==='undefined')throw new Error('Video recording is unavailable in this browser.');const candidates=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'],mime=candidates.find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw new Error('This browser has no supported MP4 or WebM encoder.');const seconds=Math.max(2,Math.min(30,options.seconds)),fps=24,stream=canvas.captureStream(fps),chunks:Blob[]=[];const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const done=new Promise<void>((resolve,reject)=>{recorder.onstop=()=>resolve();recorder.onerror=()=>reject(new Error('The browser video encoder failed.'));});const camera=this.plugin.canvas3d!.camera.getSnapshot(),visibility=[...this.entries].map(([id,e])=>({id,visible:e.visible}));recorder.start();
    try{const started=performance.now(),duration=seconds*1000;if(options.mode==='rotation'){const axis=options.axis==='x'?Vec3.unitX:options.axis==='y'?Vec3.unitY:Vec3.unitZ,offset=Vec3.sub(Vec3(),camera.position,camera.target);let progress=0;while(progress<1){progress=Math.min(1,(performance.now()-started)/duration);const angle=Math.PI*2*progress,position=Vec3.add(Vec3(),camera.target,rotateVector(Vec3(),offset,axis,angle)),up=rotateVector(Vec3(),camera.up,axis,angle);this.plugin.managers.camera.setSnapshot({...camera,position,up},0);this.plugin.canvas3d?.requestDraw();await frame();}}else{const entries=[...this.entries];if(entries.length<2)throw new Error('Flipbook recording needs at least two structures.');let progress=0,previous=-1;while(progress<1){progress=Math.min(1,(performance.now()-started)/duration);const active=Math.min(entries.length-1,Math.floor(progress*entries.length*2)%entries.length);if(active!==previous){entries.forEach(([id,e],index)=>{e.visible=index===active;this.applyVisibility(id);});this.plugin.canvas3d?.requestDraw();previous=active;}await frame();}}}finally{recorder.stop();await done;stream.getTracks().forEach(track=>track.stop());this.plugin.managers.camera.setSnapshot(camera,0);for(const saved of visibility){const entry=this.entries.get(saved.id);if(entry){entry.visible=saved.visible;this.applyVisibility(saved.id);}}}
    const blob=new Blob(chunks,{type:mime}),response=await fetch('/api/videos',{method:'POST',headers:{'Content-Type':mime,'X-Biomol-Video':'1'},body:blob,signal:this.abort.signal});if(!response.ok)throw new Error('Could not save the recorded video on the Mac.');return await response.json() as SavedFile;});}
  exportGallery(options:GalleryOptions){return this.run(async()=>{if(!this.entries.size)throw new Error('Open structures before exporting a gallery.');const candidates=options.candidateIds.filter(id=>this.entries.has(id)).slice(0,12);if(!candidates.length)throw new Error('Choose at least one candidate structure.');const saved=[...this.entries].map(([id,e])=>({id,visible:e.visible,parts:e.parts.map(p=>p.state.visible)})),camera=this.plugin.canvas3d?.camera.getSnapshot(),shots:{label:string;image:HTMLImageElement}[]=[];try{for(const candidate of candidates){for(const [id,e]of this.entries){e.visible=id===candidate||id===options.fixedStructureId;if(id===options.fixedStructureId&&options.fixedPartId)e.parts.forEach(p=>p.state.visible=p.state.id===options.fixedPartId);this.applyVisibility(id);}this.plugin.canvas3d?.requestDraw();await frame();await frame();const src=await this.captureImage(options.transparent),image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not assemble gallery image.'));img.src=src;});shots.push({label:this.entries.get(candidate)!.metadata.fileName,image});}}finally{for(const item of saved){const entry=this.entries.get(item.id);if(entry){entry.visible=item.visible;entry.parts.forEach((p,i)=>p.state.visible=item.parts[i]);this.applyVisibility(item.id);}}if(camera)this.plugin.managers.camera.setSnapshot(camera,0);}
    const columns=Math.max(1,Math.min(4,options.columns)),rows=Math.ceil(shots.length/columns),source=shots[0].image,labelHeight=34,scale=Math.min(1,4096/(columns*source.naturalWidth),4096/(rows*(source.naturalHeight+labelHeight))),w=Math.max(1,Math.floor(source.naturalWidth*scale)),h=Math.max(1,Math.floor(source.naturalHeight*scale)),out=document.createElement('canvas');out.width=w*columns;out.height=(h+labelHeight)*rows;const ctx=out.getContext('2d');if(!ctx)throw new Error('Gallery composition is unavailable.');if(!options.transparent){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,out.width,out.height);}ctx.font='600 16px system-ui';ctx.textBaseline='middle';shots.forEach((shot,i)=>{const x=i%columns*w,y=Math.floor(i/columns)*(h+labelHeight);ctx.drawImage(shot.image,x,y,w,h);ctx.fillStyle=options.transparent?'rgba(16,24,32,.88)':'#eef2f4';ctx.fillRect(x,y+h,w,labelHeight);ctx.fillStyle=options.transparent?'#fff':'#18232b';ctx.fillText(shot.label,x+10,y+h+labelHeight/2,w-20);});const image=out.toDataURL('image/png'),response=await fetch('/api/exports',{method:'POST',headers:{'Content-Type':'application/json','X-Biomol-Export':'1'},body:JSON.stringify({image,manifest:{version:1,created:new Date().toISOString(),kind:'candidate-gallery',camera,options,scene:this.getScene()}}),signal:this.abort.signal});if(!response.ok)throw new Error('Could not save the gallery on the Mac.');return await response.json() as SavedFile;});}
  getScene(): SceneStructure[] { return [...this.entries].map(([id, entry]) => ({ id, metadata: structuredClone(entry.metadata), visible: entry.visible, macFile: entry.macFile, annotations: entry.annotations.map(a=>structuredClone(a.state)), alignmentChains: entry.structure.obj ? extractAlignmentChains(entry.structure.obj.data).map(c => ({ chainId: c.chainId, authChainId: c.authChainId, kind: c.kind, count: c.anchors.length })) : [], parts: entry.parts.map(p => ({ ...p.state })) })); }
  private applyVisibility(id: string) {
    const entry = this.entries.get(id); if (!entry) return;
    for (const part of entry.parts) setSubtreeVisibility(this.plugin.state.data, part.node.ref, !(entry.visible && part.state.visible));
    for (const annotation of entry.annotations) setSubtreeVisibility(this.plugin.state.data, annotation.node.ref, !entry.visible);
    this.updateChainLabels();
  }
  setVisibility(id: string, visible: boolean, partId?: string) {
    const entry = this.entries.get(id); if (!entry || this.disposed) return;
    if (partId) { const part = entry.parts.find(p => p.state.id === partId); if (part) part.state.visible = visible; }
    else entry.visible = visible;
    this.hideDetail();
    if (this.selection.structureId === id) this.clearSelection();
    this.applyVisibility(id);
  }
  removeStructure(id: string) { return this.run(async () => {
    if (!this.entries.has(id)) return;
    if (this.selection.structureId === id) this.clearSelection();
    await this.plugin.build().delete(id).commit(); this.entries.delete(id); this.undo=this.undo.filter(u=>u.id!==id); this.lastAlignment=undefined;
    this.hideDetail(); this.updateChainLabels();
  }); }
  focusStructure(id: string) { const entry = this.entries.get(id); if (entry?.structure.obj) this.plugin.managers.camera.focusSphere(entry.structure.obj.data.boundary.sphere, { durationMs: 250 }); }
  setStyle(palette: Palette, mode: RepresentationMode) { return this.run(async () => {
    this.clearSelection();
    for (const [id, entry] of this.entries) {
      const proteinParts = entry.parts.filter(p => p.protein);
      const colors = chainColors(palette, entry.colorOffset + proteinParts.length);
      for (const part of entry.parts) {
        if (part.protein) {
          const index = proteinParts.indexOf(part);
          part.color = colors[index + entry.colorOffset]; part.state.color = colorHex(part.color);
        }
        const tree = this.plugin.build();
        this.plugin.state.data.tree.children.get(part.node.ref)?.forEach(ref => tree.delete(ref));
        await tree.commit(); await renderPart(this.plugin, part, mode, this.visualPreset, this.colorMapping);
      }
      this.applyVisibility(id);
    }
    this.palette = palette; this.mode = mode;
  }); }
  setVisualPreset(preset: VisualPreset) { return this.run(async () => {
    this.clearSelection();
    applyVisualPreset(this.plugin, preset);
    for (const [id, entry] of this.entries) {
      for (const part of entry.parts) {
        const tree = this.plugin.build();
        this.plugin.state.data.tree.children.get(part.node.ref)?.forEach(ref => tree.delete(ref));
        await tree.commit(); await renderPart(this.plugin, part, this.mode, preset, this.colorMapping);
      }
      this.applyVisibility(id);
    }
    this.visualPreset = preset;
  }); }
  setChainLabels(visible: boolean) { this.labelsVisible = visible; this.updateChainLabels(); }
  setColorMapping(mapping: ColorMapping, customScalar?: string) { return this.run(async()=>{
    const records=mapping==='custom'?parseScalarMapping(customScalar||''):undefined;
    this.clearSelection();
    for(const [id,entry] of this.entries){if(records&&entry.structure.obj)setScalarMapping(entry.structure.obj.data,records);for(const part of entry.parts){const tree=this.plugin.build();this.plugin.state.data.tree.children.get(part.node.ref)?.forEach(ref=>tree.delete(ref));await tree.commit();await renderPart(this.plugin,part,this.mode,this.visualPreset,mapping);}this.applyVisibility(id);}
    this.colorMapping=mapping;this.customScalar=records;
  });}
  private addAnnotationLoci(entryId:string,loci:StructureElement.Loci,kind:AnnotationKind,name:string,color:string){return this.run(async()=>{
    const entry=this.entries.get(entryId);if(!entry?.structure.obj||StructureElement.Loci.isEmpty(loci))throw new Error('Select one or more residues in a structure first.');
    if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Choose a six-digit annotation color.');
    const node=await this.plugin.builders.structure.tryCreateComponentFromExpression(entry.structure,StructureElement.Loci.toExpression(loci),`annotation-${kind}`);if(!node)throw new Error('Could not create this annotation.');
    const id=randomId(),state:StructureAnnotation={id,kind,name:name.trim()||kind,color,residues:[]};
    const seen=new Set<string>();StructureElement.Loci.forEachLocation(loci,location=>{const insertion=StructureProperties.residue.pdbx_PDB_ins_code(location),label=StructureProperties.residue.label_seq_id(location),auth=StructureProperties.residue.auth_seq_id(location);const residue:ResidueRef={modelId:String(location.unit.model.modelNum),chainId:StructureProperties.chain.label_asym_id(location),authChainId:StructureProperties.chain.auth_asym_id(location),residueNumber:label||auth,authResidueNumber:auth,residueName:StructureProperties.residue.label_comp_id(location),...(insertion&&insertion!=='.'&&insertion!=='?'?{insertionCode:insertion}:{})};const k=residueKey(residue);if(!seen.has(k)){seen.add(k);state.residues.push(residue);}});
    await this.plugin.builders.structure.representation.addRepresentation(node,{type:'ball-and-stick',color:'uniform',colorParams:{value:Color(Number.parseInt(color.slice(1),16))},typeParams:{sizeFactor:0.28}});
    entry.annotations.push({state,node});this.applyVisibility(entryId);return structuredClone(state);
  });}
  private lociForResidues(entryId:string,residues:ResidueRef[]){const entry=this.entries.get(entryId);if(!entry?.structure.obj)return;const root=entry.structure.obj.data;let loci=StructureElement.Loci.none(root);for(const residue of residues){const expr=MS.struct.modifier.wholeResidues([MS.struct.generator.atomGroups({'chain-test':MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_asym_id(),residue.chainId]),'residue-test':MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_seq_id(),residue.residueNumber])})]);loci=StructureElement.Loci.union(loci,StructureElement.Loci.fromExpression(root,expr));}return loci;}
  addAnnotation(kind:AnnotationKind,name:string,color:string){if(!this.selection.structureId||!this.selectedLoci)return Promise.reject(new Error('Select one or more residues in a structure first.'));return this.addAnnotationLoci(this.selection.structureId,this.selectedLoci,kind,name,color);}
  async autoAnnotate(mode:AutoAnnotationMode,structureId:string,chainA?:string,chainB?:string){const entry=this.entries.get(structureId);if(!entry?.structure.obj)throw new Error('Choose an open structure.');const created:StructureAnnotation[]=[];
    if(mode==='source-sites'){const sites=sourceDefinedSites(entry.structure.obj.data);if(!sites.length)throw new Error('This file has no deposited struct_site residue annotations.');for(const site of sites.slice(0,12)){const loci=this.lociForResidues(structureId,site.residues);if(loci&&!StructureElement.Loci.isEmpty(loci))created.push(await this.addAnnotationLoci(structureId,loci,'active-site',`Deposited site · ${site.name}`,'#ffb347'));}}
    else if(mode==='pocket-geometry'){const residues=geometryPocketResidues(entry.structure.obj.data),loci=this.lociForResidues(structureId,residues);if(loci)created.push(await this.addAnnotationLoci(structureId,loci,'pocket','Geometry pocket candidate · Beta','#ff4f81'));}
    else {if(!chainA||!chainB)throw new Error('Choose two chains for interface annotation.');const contacts=interfaceResidues(entry.structure.obj.data,chainA,chainB),a=this.lociForResidues(structureId,contacts.a),b=this.lociForResidues(structureId,contacts.b);if(!contacts.a.length||!contacts.b.length)throw new Error('No inter-chain contacts were found within 5 Å.');if(a)created.push(await this.addAnnotationLoci(structureId,a,'epitope',`Interface · ${chainA}`,'#ffcf70'));if(b)created.push(await this.addAnnotationLoci(structureId,b,'paratope',`Interface · ${chainB}`,'#62d6c8'));}
    return created;}
  removeAnnotation(structureId:string,annotationId:string){return this.run(async()=>{const entry=this.entries.get(structureId);const index=entry?.annotations.findIndex(a=>a.state.id===annotationId)??-1;if(!entry||index<0)return;const [annotation]=entry.annotations.splice(index,1);await this.plugin.build().delete(annotation.node.ref).commit();});}
  getSequence(structureId:string,chainId:string){const entry=this.entries.get(structureId);if(!entry?.structure.obj)throw new Error('Structure is no longer open.');return{structureId,fileName:entry.metadata.fileName,chainId,authChainId:entry.metadata.chains.find(c=>c.chainId===chainId)?.authChainId||chainId,residues:sequenceResidues(entry.structure.obj.data,entry.annotations.map(a=>a.state),chainId)};}
  selectSequenceResidue(structureId:string,residue:ResidueRef,additive=false){const entry=this.entries.get(structureId);if(!entry?.structure.obj)return;const loci=this.lociForResidues(structureId,[residue]);if(!loci||StructureElement.Loci.isEmpty(loci))return;if(additive&&this.selection.structureId===structureId&&this.selectedLoci){const index=this.selection.residues.findIndex(r=>residueKey(r)===residueKey(residue));if(index>=0){this.selectedLoci=StructureElement.Loci.subtract(this.selectedLoci,loci);this.selection={...this.selection,residues:this.selection.residues.filter((_,i)=>i!==index)};this.plugin.managers.interactivity.lociSelects.deselect({loci},false);}else{this.selectedLoci=StructureElement.Loci.union(this.selectedLoci,loci);this.selection={...this.selection,residues:[...this.selection.residues,residue]};this.plugin.managers.interactivity.lociSelects.select({loci},false);}}else{this.clearSelection();this.selectedLoci=loci;this.selection={residues:[residue],structureId,fileName:entry.metadata.fileName};this.plugin.managers.interactivity.lociSelects.selectOnly({loci},false);}this.emitSelection();}
  measureSelection(kind:'distance'|'angle'|'dihedral'|'rmsd'|'radius'):MeasurementResult{const entry=this.selection.structureId?this.entries.get(this.selection.structureId):undefined;if(!entry?.structure.obj)throw new Error('Select residues from one structure first.');return measurePoints(kind,selectedAnchorPoints(entry.structure.obj.data,this.selection.residues));}
  measureInterface(structureId:string,chainA:string,chainB:string){const entry=this.entries.get(structureId);if(!entry?.structure.obj)throw new Error('Structure is no longer open.');return interfaceArea(entry.structure.obj.data,chainA,chainB);}
  private updateChainLabels() {
    if (!this.labelLayer) return;
    this.labelLayer.replaceChildren();
    const canvas = this.plugin.canvas3d;
    if (!this.labelsVisible || !canvas) return;
    const sx = this.host.clientWidth / canvas.camera.viewport.width;
    const sy = this.host.clientHeight / canvas.camera.viewport.height;
    for (const entry of this.entries.values()) for (const part of entry.parts) {
      if (!entry.visible || !part.protein || !part.state.visible || !part.node.obj) continue;
      const point = canvas.camera.project(Vec4(), part.node.obj.data.boundary.sphere.center);
      if (point[2] < 0 || point[2] > 1) continue;
      const label = document.createElement('span');
      const chain = part.state.label.replace(/^Protein · Chain /, '');
      label.className = 'chain-label';
      label.textContent = `${entry.metadata.fileName} · ${chain}`;
      label.style.left = `${point[0] * sx}px`;
      label.style.bottom = `${point[1] * sy}px`;
      label.style.setProperty('--chain-color', colorHex(part.color));
      this.labelLayer.appendChild(label);
    }
  }
  setPicking(mode: 'residue' | 'atom') { this.picking = mode; this.clearSelection(false); }
  focusSelection() { if (this.selectedLoci) this.plugin.managers.camera.focusLoci(this.selectedLoci, { minRadius: this.picking === 'atom' ? 1.5 : 3, extraRadius: 1, durationMs: 250 }); }
  showNeighborhood() { return this.run(async () => {
    if (!this.selectedLoci) return;
    if(this.detailRefs.length){const update=this.plugin.build();for(const ref of this.detailRefs)if(this.plugin.state.data.cells.has(ref))update.delete(ref);await update.commit();this.detailRefs=[];}
    const search=neighborhoodSearch(this.selectedLoci);let atomCount=0,fileCount=0;
    try {
      for(const entry of this.entries.values()){
        const visible=this.visibleStructure(entry);if(!visible?.elementCount || !entry.structure.obj)continue;
        const loci=search(visible,entry.structure.obj.data);if(StructureElement.Loci.isEmpty(loci))continue;
        const node=await this.plugin.builders.structure.tryCreateComponentFromExpression(entry.structure,StructureElement.Loci.toExpression(loci),'local-detail');
        if(node){this.detailRefs.push(node.ref);atomCount+=node.obj?.data.elementCount||0;fileCount++;
          const color=chainColors(this.palette,entry.colorOffset+1)[entry.colorOffset];
          await this.plugin.builders.structure.representation.addRepresentation(node,{type:'ball-and-stick',color:'element-symbol',colorParams:{carbonColor:{name:'uniform',params:{value:color}}},typeParams:{sizeFactor:0.22}});
        }
      }
    }catch(error){this.hideDetail();throw error;}
    this.selection={...this.selection,neighborhood:{atomCount,fileCount}};this.emitSelection();
    this.plugin.managers.camera.focusLoci(this.selectedLoci,{minRadius:6,extraRadius:1,durationMs:250});
  }); }
  private visibleStructure(entry: Loaded & {visible:boolean}) {
    if(!entry.visible || !entry.structure.obj)return undefined;
    return visibleSubset(entry.structure.obj.data,entry.parts.map(part=>({visible:part.state.visible,structure:part.node.obj?.data})));
  }
  autoView(){return this.run(async()=>{
    const canvas=this.plugin.canvas3d;if(!canvas)return;
    const points:[number,number,number][]=[];
    // Sample each visible component uniformly, bounding CPU and memory on iPad.
    const visible=[...this.entries.values()].map(e=>this.visibleStructure(e)).filter(s=>s && s.elementCount>0);
    const total=visible.reduce((sum,s)=>sum+s!.elementCount,0),stride=Math.max(1,Math.ceil(total/4000));let index=0;
    const min=Vec3.create(Infinity,Infinity,Infinity),max=Vec3.create(-Infinity,-Infinity,-Infinity);
    for(const structure of visible)for(const unit of structure!.units)for(let i=0;i<OrderedSet.size(unit.elements);i++){const p=unit.conformation.position(OrderedSet.getAt(unit.elements,i),Vec3());if(!p.every(Number.isFinite))continue;Vec3.min(min,min,p);Vec3.max(max,max,p);if(index++%stride===0)points.push([p[0],p[1],p[2]]);}
    const before=canvas.camera.getSnapshot(),direction=Vec3.sub(Vec3(),before.position,before.target);
    const result=bestView(points,canvas.camera.viewport.width/canvas.camera.viewport.height,direction,before.up,{min,max});
    // A bounding sphere makes the zoom conservative: selected visible geometry stays within view.
    const snapshot=canvas.camera.getInvariantFocus(result.center,result.radius*1.08,result.up,Vec3.negate(Vec3(),result.direction));
    this.previousView=before;this.plugin.managers.camera.setSnapshot(snapshot,350);
  });}
  undoView(){if(this.previousView){this.plugin.managers.camera.setSnapshot(this.previousView,250);this.previousView=undefined;}}
  resetCamera() { if (!this.disposed) this.plugin.managers.camera.reset(); }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.abort.abort();
    this.observer.disconnect(); this.clickSubscription.unsubscribe(); this.drawSubscription?.unsubscribe(); this.labelLayer?.remove(); this.listeners.clear();
    this.plugin.unmount(); this.plugin.animationLoop.stop();
    if (this.pending) void this.pending.then(() => this.plugin.dispose(), () => this.plugin.dispose()); else this.plugin.dispose();
  }
}
