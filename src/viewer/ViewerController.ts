import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import type { Camera } from 'molstar/lib/mol-canvas3d/camera';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { StructureElement, StructureProperties, Bond } from 'molstar/lib/mol-model/structure';
import { neighborhoodSearch, visibleSubset } from './visibleAtoms';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { ButtonsType } from 'molstar/lib/mol-util/input/input-observer';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { bestView } from './bestView';
import { Mat4, Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { extractAlignmentChains, fitChains, residueKey } from './alignment';
import type { AlignmentRequest, AlignmentReport } from './alignment';
import { examplePath } from './examples';
import { createViewer } from './createViewer';
import { detectFormat, loadStructure } from './structureLoader';
import { residueFromLoci } from './selection';
import { chainColors, renderPart } from './representations';
import { fetchStructure, rcsbId } from './sources';
import type { BiomolViewer, SelectionState, SceneStructure, Palette, RepresentationMode } from './types';
type Loaded = Awaited<ReturnType<typeof loadStructure>>;
export class ViewerController implements BiomolViewer {
  private entries = new Map<string, Loaded & { visible: boolean; macFile?: string; matrix: Mat4 }>();
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
  private listeners = new Set<(selection: SelectionState) => void>();
  private clickSubscription;
  private disposed = false;
  private pending?: Promise<unknown>;
  private abort = new AbortController();
  private constructor(private plugin: PluginContext, private observer: ResizeObserver) {
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
    return new ViewerController(plugin, observer);
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
      const offset = replaceId ? this.entries.get(replaceId)?.colorOffset ?? this.colorSerial : this.colorSerial;
      const loaded = await loadStructure(this.plugin, text, file.name, format, this.palette, this.mode, offset);
      if (!replaceId) this.colorSerial++;
      if (!this.disposed) {
        this.clearSelection();
        const previous = replaceId ? this.entries.get(replaceId) : undefined;
        if (previous) {
          for (const part of loaded.parts) part.state.visible = previous.parts.find(p => p.state.id === part.state.id)?.state.visible ?? part.state.visible;
          await this.plugin.build().delete(replaceId!).commit(); this.entries.delete(replaceId!); this.undo=this.undo.filter(u=>u.id!==replaceId); this.lastAlignment=undefined;
        }
        this.entries.set(loaded.dataRef, { ...loaded, visible: previous?.visible ?? true, macFile, matrix: Mat4.identity() });
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
    this.entries.clear();this.previousView=undefined;this.undo=[];this.lastAlignment=undefined;this.detailRefs=[];this.addSelection=false;this.colorSerial=0;this.resetCamera();
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
    const response = await fetch('/api/exports', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Biomol-Export': '1' }, body: JSON.stringify({ image, manifest: { version: 1, created: new Date().toISOString(), transparent, scene: this.getScene(), transforms: [...this.entries].map(([id,e]) => ({ id, matrix: Array.from(e.matrix) })), camera: this.plugin.canvas3d?.camera.getSnapshot(), alignment: this.lastAlignment } }), signal: this.abort.signal });
    if (!response.ok) throw new Error('Could not save the image on the Mac. Check the export folder and server.');
    return await response.json() as { name: string; url: string; metadataUrl: string };
  }); }
  getScene(): SceneStructure[] { return [...this.entries].map(([id, entry]) => ({ id, metadata: structuredClone(entry.metadata), visible: entry.visible, macFile: entry.macFile, alignmentChains: entry.structure.obj ? extractAlignmentChains(entry.structure.obj.data).map(c => ({ chainId: c.chainId, authChainId: c.authChainId, kind: c.kind, count: c.anchors.length })) : [], parts: entry.parts.map(p => ({ ...p.state })) })); }
  private applyVisibility(id: string) {
    const entry = this.entries.get(id); if (!entry) return;
    for (const part of entry.parts) setSubtreeVisibility(this.plugin.state.data, part.node.ref, !(entry.visible && part.state.visible));
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
    this.hideDetail();
  }); }
  focusStructure(id: string) { const entry = this.entries.get(id); if (entry?.structure.obj) this.plugin.managers.camera.focusSphere(entry.structure.obj.data.boundary.sphere, { durationMs: 250 }); }
  setStyle(palette: Palette, mode: RepresentationMode) { return this.run(async () => {
    this.clearSelection();
    for (const [id, entry] of this.entries) {
      const proteinParts = entry.parts.filter(p => p.protein);
      const colors = chainColors(palette, Math.max(8, proteinParts.length));
      for (const part of entry.parts) {
        if (part.protein) {
          const index = proteinParts.indexOf(part);
          part.color = colors[(index + entry.colorOffset) % colors.length]; part.state.color = '#' + part.color.toString(16).padStart(6, '0');
        }
        const tree = this.plugin.build();
        this.plugin.state.data.tree.children.get(part.node.ref)?.forEach(ref => tree.delete(ref));
        await tree.commit(); await renderPart(this.plugin, part, mode);
      }
      this.applyVisibility(id);
    }
    this.palette = palette; this.mode = mode;
  }); }
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
          const color=chainColors(this.palette,8)[entry.colorOffset%8];
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
    this.observer.disconnect(); this.clickSubscription.unsubscribe(); this.listeners.clear();
    this.plugin.unmount(); this.plugin.animationLoop.stop();
    if (this.pending) void this.pending.then(() => this.plugin.dispose(), () => this.plugin.dispose()); else this.plugin.dispose();
  }
}
