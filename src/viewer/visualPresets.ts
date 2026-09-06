import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { Color } from 'molstar/lib/mol-util/color';
import type { VisualPreset } from './types';

export const visualPresetOptions: { id: VisualPreset; label: string; description: string }[] = [
  { id: 'discussion', label: 'Quick discussion', description: 'Responsive, clean shading for live exploration.' },
  { id: 'presentation', label: 'Presentation', description: 'Bold ribbons, stronger light, and soft depth.' },
  { id: 'publication', label: 'Publication', description: 'Fine ribbons, restrained light, crisp outlines.' },
];

export function cartoonParams(preset: VisualPreset) {
  if (preset === 'presentation') return { sizeFactor: 0.24, aspectRatio: 5.6, radialSegments: 20, linearSegments: 10 };
  if (preset === 'publication') return { sizeFactor: 0.18, aspectRatio: 4.6, radialSegments: 24, linearSegments: 12 };
  return { sizeFactor: 0.2, aspectRatio: 5, radialSegments: 16, linearSegments: 8 };
}

export function applyVisualPreset(plugin: PluginContext, preset: VisualPreset) {
  const canvas = plugin.canvas3d;
  if (!canvas) return;
  const off = { name: 'off' as const, params: {} };
  if (preset === 'discussion') {
    canvas.setProps({
      renderer: { exposure: 1, ambientIntensity: 0.48, light: [{ inclination: 150, azimuth: 320, color: Color(0xffffff), intensity: 0.62 }] },
      postprocessing: { occlusion: off, shadow: off, outline: off, bloom: off },
    });
  } else if (preset === 'presentation') {
    canvas.setProps({
      renderer: { exposure: 1.08, ambientIntensity: 0.38, light: [{ inclination: 145, azimuth: 315, color: Color(0xffffff), intensity: 0.9 }, { inclination: 75, azimuth: 120, color: Color(0xbcdcff), intensity: 0.22 }] },
      postprocessing: { occlusion: { name: 'on', params: { ...canvas.props.postprocessing.occlusion.params, samples: 16, radius: 4, bias: 0.8, resolutionScale: 0.75 } }, shadow: { name: 'on', params: { steps: 2, maxDistance: 3, tolerance: 1 } }, outline: { name: 'on', params: { scale: 1, threshold: 0.35, color: Color(0x12202a), includeTransparent: true } }, bloom: off },
    });
  } else {
    canvas.setProps({
      renderer: { exposure: 1.02, ambientIntensity: 0.5, light: [{ inclination: 155, azimuth: 320, color: Color(0xffffff), intensity: 0.72 }] },
      postprocessing: { occlusion: { name: 'on', params: { ...canvas.props.postprocessing.occlusion.params, samples: 24, radius: 3, bias: 0.9, resolutionScale: 1 } }, shadow: off, outline: { name: 'on', params: { scale: 1, threshold: 0.25, color: Color(0x17232b), includeTransparent: true } }, bloom: off },
    });
  }
}
