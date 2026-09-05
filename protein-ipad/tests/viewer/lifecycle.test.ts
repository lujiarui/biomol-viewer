import { afterEach, expect, test, vi } from 'vitest';
import { ViewerController } from '../../src/viewer/ViewerController';
import { createViewer } from '../../src/viewer/createViewer';
import { loadStructure } from '../../src/viewer/structureLoader';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
vi.mock('../../src/viewer/createViewer', () => ({ createViewer: vi.fn() }));
vi.mock('../../src/viewer/structureLoader', () => ({ detectFormat: () => 'mmcif', loadStructure: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

function setup() {
  const disconnect = vi.fn();
  const unsubscribe = vi.fn();
  const plugin = {
    managers: { interactivity: { setProps: vi.fn(), lociSelects: { deselectAll: vi.fn() } }, camera: { reset: vi.fn() } },
    behaviors: { interaction: { click: { subscribe: () => ({ unsubscribe }) } } },
    handleResize: vi.fn(), unmount: vi.fn(), animationLoop: { stop: vi.fn() }, dispose: vi.fn(),
  };
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
  vi.mocked(createViewer).mockResolvedValue(plugin as unknown as PluginContext);
  return { plugin, disconnect, unsubscribe };
}
test('disposal disconnects resize and events exactly once, then rejects new loads', async () => {
  const { plugin, disconnect, unsubscribe } = setup();
  const viewer = await ViewerController.create({} as HTMLDivElement, new AbortController().signal);
  viewer.dispose(); viewer.dispose();
  expect(plugin.unmount).toHaveBeenCalledTimes(1);
  expect(plugin.dispose).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  await expect(viewer.loadFile(new File(['data'], 'x.cif'))).rejects.toThrow('Viewer is closed');
});
test('unmount during parsing detaches immediately and defers plugin disposal until completion', async () => {
  const { plugin } = setup();
  const metadata = { fileName: 'x.cif', format: 'mmcif' as const, chains: [], atomCount: 1, residueCount: 1 };
  let finish!: (value: { dataRef: string; metadata: typeof metadata }) => void;
  vi.mocked(loadStructure).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const viewer = await ViewerController.create({} as HTMLDivElement, new AbortController().signal);
  const pending = viewer.loadFile(new File(['data'], 'x.cif'));
  await vi.waitFor(() => expect(loadStructure).toHaveBeenCalledOnce());
  await expect(viewer.loadFile(new File(['data'], 'other.cif'))).rejects.toThrow('already loading');
  viewer.dispose();
  expect(plugin.unmount).toHaveBeenCalledOnce();
  expect(plugin.dispose).not.toHaveBeenCalled();
  finish({ dataRef: 'new-data', metadata });
  await pending;
  expect(plugin.dispose).toHaveBeenCalledOnce();
  expect(plugin.managers.camera.reset).not.toHaveBeenCalled();
});
