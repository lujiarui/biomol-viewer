import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { PluginSpec } from 'molstar/lib/mol-plugin/spec';
import { PluginBehaviors } from 'molstar/lib/mol-plugin/behavior';
import { Color } from 'molstar/lib/mol-util/color';

/** Headless plugin: native camera input, no Mol* UI, focus-on-click, or remote services. */
export async function createViewer(host: HTMLDivElement, signal: AbortSignal) {
  const plugin = new PluginContext({
    behaviors: [
      PluginSpec.Behavior(PluginBehaviors.Representation.HighlightLoci),
      PluginSpec.Behavior(PluginBehaviors.Representation.SelectLoci),
      PluginSpec.Behavior(PluginBehaviors.Camera.CameraControls),
      PluginSpec.Behavior(PluginBehaviors.CustomProps.SecondaryStructure),
    ],
    layout: { initial: { isExpanded: false, showControls: false } },
  });
  try {
    await plugin.init();
    signal.throwIfAborted();
    if (!await plugin.mountAsync(host)) throw new Error('WebGL is unavailable. Try a browser with WebGL enabled.');
    signal.throwIfAborted();
    plugin.canvas3d!.setProps({
      renderer: { backgroundColor: Color(0x111820), selectColor: Color(0xffcf70) },
      trackball: { gestureScaleFactor: 0.25, zoomSpeed: 4, staticMoving: false, dynamicDampingFactor: 0.35, minDistance: 0.5, autoAdjustMinMaxDistance: { name: 'off', params: {} } },
      cameraClipping: { minNear: 0.1 },
      camera: { helper: { axes: { name: 'off', params: {} } } },
    });
    return plugin;
  } catch (error) {
    plugin.dispose();
    throw error;
  }
}
