import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { createViewer } from './createViewer';
import { addDefaultRepresentations } from './representations';

export class ViewerController {
  private constructor(private plugin: PluginContext, private observer: ResizeObserver) {}
  static async create(host: HTMLDivElement, signal: AbortSignal) {
    const plugin = await createViewer(host, signal);
    const observer = new ResizeObserver(() => plugin.handleResize());
    observer.observe(host);
    return new ViewerController(plugin, observer);
  }
  async loadExample() {
    const response = await fetch(`${import.meta.env.BASE_URL}examples/example.cif`);
    if (!response.ok) throw new Error('Unable to load the bundled example.');
    const data = await this.plugin.builders.data.rawData({ data: await response.text(), label: 'Crambin · 1CRN' });
    const trajectory = await this.plugin.builders.structure.parseTrajectory(data, 'mmcif');
    const model = await this.plugin.builders.structure.createModel(trajectory);
    const structure = await this.plugin.builders.structure.createStructure(model, { name: 'model', params: {} });
    await addDefaultRepresentations(this.plugin, structure);
    this.plugin.managers.camera.reset();
  }
  dispose() { this.observer.disconnect(); this.plugin.dispose(); }
}
