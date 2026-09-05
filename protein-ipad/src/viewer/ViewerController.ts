import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { createViewer } from './createViewer';
import { detectFormat, loadStructure } from './structureLoader';
import type { ProteinViewer, StructureMetadata, SelectionState } from './types';
import { residueFromLoci } from './selection';
import { ButtonsType } from 'molstar/lib/mol-util/input/input-observer';

export class ViewerController implements ProteinViewer {
  private dataRef?: string;
  private selection: SelectionState = { residues: [] };
  private listeners = new Set<(selection: SelectionState) => void>();
  private clickSubscription;
  private disposed = false;
  private pending?: Promise<StructureMetadata>;
  private abort = new AbortController();
  private constructor(private plugin: PluginContext, private observer: ResizeObserver) {
    plugin.managers.interactivity.setProps({ granularity: 'residue' });
    this.clickSubscription = plugin.behaviors.interaction.click.subscribe(event => {
      if (this.disposed || this.pending || event.button !== ButtonsType.Flag.Primary) return;
      const picked = residueFromLoci(event.current.loci);
      if (!picked) return; // Background taps keep the current selection.
      plugin.managers.interactivity.lociSelects.selectOnly({ loci: picked.loci }, false);
      this.selection = { residues: [picked.residue] };
      this.emitSelection();
    });
  }
  getSelection(): SelectionState { return { residues: this.selection.residues.map(residue => ({ ...residue })) }; }
  subscribeSelection(callback: (selection: SelectionState) => void) {
    this.listeners.add(callback);
    callback(this.getSelection());
    return () => { this.listeners.delete(callback); };
  }
  private emitSelection() { for (const listener of this.listeners) listener(this.getSelection()); }
  clearSelection() {
    if (this.disposed) return;
    this.plugin.managers.interactivity.lociSelects.deselectAll();
    this.selection = { residues: [] };
    this.emitSelection();
  }
  static async create(host: HTMLDivElement, signal: AbortSignal): Promise<ProteinViewer> {
    const plugin = await createViewer(host, signal);
    const observer = new ResizeObserver(() => plugin.handleResize());
    observer.observe(host);
    return new ViewerController(plugin, observer);
  }
  private runLoad(read: () => Promise<File>) {
    if (this.disposed) return Promise.reject(new Error('Viewer is closed.'));
    if (this.pending) return Promise.reject(new Error('A structure is already loading.'));
    const task = (async () => {
      const file = await read();
      const format = detectFormat(file.name);
      const text = await file.text();
      this.abort.signal.throwIfAborted();
      const loaded = await loadStructure(this.plugin, text, file.name, format);
      if (!this.disposed) this.clearSelection();
      if (this.dataRef) await this.plugin.build().delete(this.dataRef).commit();
      this.dataRef = loaded.dataRef;
      if (!this.disposed) this.resetCamera();
      return loaded.metadata;
    })();
    this.pending = task;
    // Both paths release the lock without creating an unhandled rejected promise.
    void task.then(() => { this.pending = undefined; }, () => { this.pending = undefined; });
    return task;
  }
  loadFile(file: File) { return this.runLoad(async () => file); }
  loadExample() {
    return this.runLoad(async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}examples/example.cif`, { signal: this.abort.signal });
      if (!response.ok) throw new Error('Unable to load the bundled example.');
      return new File([await response.text()], 'Crambin · 1CRN.cif');
    });
  }
  resetCamera() { if (!this.disposed) this.plugin.managers.camera.reset(); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.observer.disconnect();
    this.clickSubscription.unsubscribe();
    this.listeners.clear();
    this.plugin.unmount();
    this.plugin.animationLoop.stop();
    if (this.pending) void this.pending.then(() => this.plugin.dispose(), () => this.plugin.dispose());
    else this.plugin.dispose();
  }
}
