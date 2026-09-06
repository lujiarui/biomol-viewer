import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { Color } from 'molstar/lib/mol-util/color';
import type { VisualPreset } from './types';

export const visualPresetOptions: { id: VisualPreset; label: string; description: string }[] = [
  { id: 'default', label: 'Original default', description: 'The original responsive Mol* appearance.' },
  { id: 'studio', label: 'Studio quality', description: 'AO, soft shadow, depth cue, SMAA, and depth-peeled transparency.' },
  { id: 'publication', label: 'Publication quality', description: 'High-sample AO, restrained depth cue, crisp outline, SMAA, and depth-peeled transparency.' },
];

export function cartoonParams(preset: VisualPreset) {
  if (preset === 'studio') return { sizeFactor: 0.22, aspectRatio: 5.2, radialSegments: 24, linearSegments: 12 };
  if (preset === 'publication') return { sizeFactor: 0.19, aspectRatio: 4.8, radialSegments: 32, linearSegments: 16 };
  return { sizeFactor: 0.2, aspectRatio: 5, radialSegments: 16, linearSegments: 8 };
}

type Baseline = Pick<NonNullable<PluginContext['canvas3d']>['props'], 'renderer'|'postprocessing'|'cameraFog'> & { transparency:'blended'|'wboit'|'dpoit' };
const baselines = new WeakMap<PluginContext, Baseline>();
export function applyVisualPreset(plugin: PluginContext, preset: VisualPreset) {
  const canvas = plugin.canvas3d;
  if (!canvas) return;
  if (!baselines.has(plugin)) baselines.set(plugin, {
    renderer: structuredClone(canvas.props.renderer), postprocessing: structuredClone(canvas.props.postprocessing),
    cameraFog: structuredClone(canvas.props.cameraFog), transparency: plugin.canvas3dContext?.props.transparency??'wboit',
  });
  if (preset === 'default') { const baseline=baselines.get(plugin)!;plugin.canvas3dContext?.setProps({transparency:baseline.transparency});canvas.setProps({renderer:baseline.renderer,postprocessing:baseline.postprocessing,cameraFog:baseline.cameraFog});return; }
  const off = { name: 'off' as const, params: {} };
  const studio = preset === 'studio';
  plugin.canvas3dContext?.setProps({transparency:'dpoit'});canvas.setProps({
    cameraFog: { name: 'on', params: { intensity: studio ? 28 : 18 } },
    renderer: { exposure: studio ? 1.04 : 1, ambientIntensity: studio ? 0.42 : 0.52, light: studio ? [{ inclination: 145, azimuth: 315, color: Color(0xffffff), intensity: 0.82 }, { inclination: 65, azimuth: 125, color: Color(0xbfdcff), intensity: 0.2 }] : [{ inclination: 150, azimuth: 320, color: Color(0xffffff), intensity: 0.72 }] },
    postprocessing: {
      enabled: true,
      occlusion: { name: 'on', params: { ...canvas.props.postprocessing.occlusion.params, samples: studio ? 32 : 48, radius: studio ? 4 : 3.2, bias: 0.85, blurKernelSize: 15, resolutionScale: 1, color: Color(0x000000), transparentThreshold: 0.35 } },
      shadow: { name: 'on', params: { steps: studio ? 3 : 2, maxDistance: studio ? 4 : 2.5, tolerance: 1 } },
      outline: studio ? off : { name: 'on', params: { scale: 1, threshold: 0.28, color: Color(0x17232b), includeTransparent: true } },
      dof: studio ? { name: 'on', params: { blurSize: 5, blurSpread: 0.45, inFocus: 0, PPM: 42, center: 'camera-target', mode: 'plane' } } : off,
      antialiasing: { name: 'smaa', params: { edgeThreshold: 0.08, maxSearchSteps: studio ? 16 : 32 } },
      sharpening: studio ? off : { name: 'on', params: { sharpness: 0.35, denoise: true } }, bloom: off,
    },
  });
}
