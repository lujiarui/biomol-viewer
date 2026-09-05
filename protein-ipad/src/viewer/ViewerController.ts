import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { StructureElement, StructureProperties, Bond } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { ButtonsType } from 'molstar/lib/mol-util/input/input-observer';
import { createViewer } from './createViewer';
import { detectFormat, loadStructure } from './structureLoader';
import { residueFromLoci } from './selection';
import { chainColors, renderPart } from './representations';
import { fetchStructure, rcsbId } from './sources';
import type { ProteinViewer, SelectionState, SceneStructure, Palette, RepresentationMode } from './types';
type Loaded = Awaited<ReturnType<typeof loadStructure>>;
export class ViewerController implements ProteinViewer {
  private entries = new Map<string, Loaded & { visible: boolean; macFile?: string }>();
  private selection: SelectionState = { residues: [] };
  private selectedLoci?: StructureElement.Loci;
  private detailRef?: string;
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
      if (this.disposed || this.pending || event.button !== ButtonsType.Flag.Primary) return;
      const raw = Bond.isLoci(event.current.loci) ? Bond.toFirstStructureElementLoci(event.current.loci) : event.current.loci;
      const picked = residueFromLoci(raw);
      if (!picked) return;
      const entry = [...this.entries.entries()].find(([, item]) => item.structure.obj?.data.root === picked.loci.structure.root);
      if (!entry) return;
      if (this.picking === 'atom' && (!StructureElement.Loci.is(raw) || StructureElement.Loci.size(raw) !== 1)) return;
      this.selectedLoci = this.picking === 'atom' && StructureElement.Loci.is(raw) ? raw : picked.loci;
      plugin.managers.interactivity.lociSelects.selectOnly({ loci: this.selectedLoci }, false);
      const location = StructureElement.Loci.getFirstLocation(this.selectedLoci);
      this.selection = { residues: [picked.residue], structureId: entry[0], fileName: entry[1].metadata.fileName, ...(this.picking === 'atom' && location ? { atomName: StructureProperties.atom.label_atom_id(location) } : {}) };
      this.emitSelection();
    });
  }
  static async create(host: HTMLDivElement, signal: AbortSignal): Promise<ProteinViewer> {
    const plugin = await createViewer(host, signal);
    const observer = new ResizeObserver(() => plugin.handleResize());
    observer.observe(host);
    return new ViewerController(plugin, observer);
  }
  getSelection(): SelectionState { return { ...this.selection, residues: this.selection.residues.map(r => ({ ...r })) }; }
  subscribeSelection(callback: (selection: SelectionState) => void) { this.listeners.add(callback); callback(this.getSelection()); return () => { this.listeners.delete(callback); }; }
  private emitSelection() { for (const listener of this.listeners) listener(this.getSelection()); }
  private hideDetail() {
    if (this.detailRef && this.plugin.state.data.cells.has(this.detailRef)) setSubtreeVisibility(this.plugin.state.data, this.detailRef, true);
    else this.detailRef = undefined;
  }
  clearSelection(hideDetail = true) {
    if (this.disposed) return;
    if (hideDetail) this.hideDetail();
    this.plugin.managers.interactivity.lociSelects.deselectAll();
    this.selection = { residues: [] }; this.selectedLoci = undefined; this.emitSelection();
  }
  private run<T>(work: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new Error('Viewer is closed.'));
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
      const loaded = await loadStructure(this.plugin, text, file.name, format, this.palette, this.mode);
      if (!this.disposed) {
        this.clearSelection();
        const previous = replaceId ? this.entries.get(replaceId) : undefined;
        if (previous) {
          for (const part of loaded.parts) part.state.visible = previous.parts.find(p => p.state.id === part.state.id)?.state.visible ?? part.state.visible;
          await this.plugin.build().delete(replaceId!).commit(); this.entries.delete(replaceId!);
        }
        this.entries.set(loaded.dataRef, { ...loaded, visible: previous?.visible ?? true, macFile });
        this.applyVisibility(loaded.dataRef);
        this.focusStructure(loaded.dataRef);
      }
      return loaded.metadata;
    });
  }
  loadFile(file: File) { return this.runLoad(async () => file); }
  loadExample() { return this.runLoad(() => fetchStructure(`${import.meta.env.BASE_URL}examples/example.cif`, 'Crambin · 1CRN.cif', this.abort.signal)); }
  loadRcsb(input: string) { return this.runLoad(() => { const id = rcsbId(input); return fetchStructure(`https://files.rcsb.org/download/${id}.cif`, `${id}.cif`, this.abort.signal); }); }
  loadMacFile(name: string) { return this.runLoad(() => fetchStructure(`/api/library/file?name=${encodeURIComponent(name)}`, name, this.abort.signal), name); }
  reloadMacStructure(id: string) {
    const name = this.entries.get(id)?.macFile;
    if (!name) return Promise.reject(new Error('This structure is not from the Mac library.'));
    return this.runLoad(() => fetchStructure(`/api/library/file?name=${encodeURIComponent(name)}`, name, this.abort.signal), name, id);
  }
  getScene(): SceneStructure[] { return [...this.entries].map(([id, entry]) => ({ id, metadata: structuredClone(entry.metadata), visible: entry.visible, macFile: entry.macFile, parts: entry.parts.map(p => ({ ...p.state })) })); }
  private applyVisibility(id: string) {
    const entry = this.entries.get(id); if (!entry) return;
    for (const part of entry.parts) setSubtreeVisibility(this.plugin.state.data, part.node.ref, !(entry.visible && part.state.visible));
  }
  setVisibility(id: string, visible: boolean, partId?: string) {
    const entry = this.entries.get(id); if (!entry || this.disposed) return;
    if (partId) { const part = entry.parts.find(p => p.state.id === partId); if (part) part.state.visible = visible; }
    else entry.visible = visible;
    if (this.selection.structureId === id) this.clearSelection();
    this.applyVisibility(id);
  }
  removeStructure(id: string) { return this.run(async () => {
    if (!this.entries.has(id)) return;
    if (this.selection.structureId === id) this.clearSelection();
    await this.plugin.build().delete(id).commit(); this.entries.delete(id);
    if (this.detailRef && !this.plugin.state.data.cells.has(this.detailRef)) this.detailRef = undefined;
  }); }
  focusStructure(id: string) { const entry = this.entries.get(id); if (entry?.structure.obj) this.plugin.managers.camera.focusSphere(entry.structure.obj.data.boundary.sphere, { durationMs: 250 }); }
  setStyle(palette: Palette, mode: RepresentationMode) { return this.run(async () => {
    this.clearSelection();
    for (const [id, entry] of this.entries) {
      const proteinParts = entry.parts.filter(p => p.protein);
      const colors = chainColors(palette, proteinParts.length);
      for (const part of entry.parts) {
        if (part.protein) {
          const index = proteinParts.indexOf(part);
          part.color = colors[index]; part.state.color = '#' + part.color.toString(16).padStart(6, '0');
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
    const entry = this.entries.get(this.selection.structureId || '');
    if (!entry || !this.selectedLoci) return;
    if (this.detailRef) { await this.plugin.build().delete(this.detailRef).commit(); this.detailRef = undefined; }
    const expression = MS.struct.modifier.includeSurroundings({ 0: StructureElement.Loci.toExpression(this.selectedLoci), radius: 5, 'as-whole-residues': true });
    const node = await this.plugin.builders.structure.tryCreateComponentFromExpression(entry.structure, expression, 'local-detail');
    if (node) {
      this.detailRef = node.ref;
      await this.plugin.builders.structure.representation.addRepresentation(node, { type: 'ball-and-stick', color: 'element-symbol', typeParams: { sizeFactor: 0.22 } });
      this.plugin.managers.camera.focusLoci(this.selectedLoci, { minRadius: 6, extraRadius: 1, durationMs: 250 });
    }
  }); }
  resetCamera() { if (!this.disposed) this.plugin.managers.camera.reset(); }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.abort.abort();
    this.observer.disconnect(); this.clickSubscription.unsubscribe(); this.listeners.clear();
    this.plugin.unmount(); this.plugin.animationLoop.stop();
    if (this.pending) void this.pending.then(() => this.plugin.dispose(), () => this.plugin.dispose()); else this.plugin.dispose();
  }
}
