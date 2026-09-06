import { describe, expect, test, vi } from 'vitest';
import { applyVisualPreset, visualPresetOptions } from '../../src/viewer/visualPresets';

describe('professional visual presets',()=>{
 test('keeps original default and restores its renderer state',()=>{const setProps=vi.fn(),setContext=vi.fn(),plugin={canvas3d:{props:{renderer:{exposure:.9},postprocessing:{occlusion:{name:'off',params:{}},shadow:{name:'off',params:{}},outline:{name:'off',params:{}},dof:{name:'off',params:{}},antialiasing:{name:'smaa',params:{}},sharpening:{name:'off',params:{}},bloom:{name:'off',params:{}}},cameraFog:{name:'off',params:{}}},setProps},canvas3dContext:{props:{transparency:'wboit'},setProps:setContext}} as never;applyVisualPreset(plugin,'studio');expect(setContext).toHaveBeenLastCalledWith({transparency:'dpoit'});applyVisualPreset(plugin,'default');expect(setContext).toHaveBeenLastCalledWith({transparency:'wboit'});expect(setProps).toHaveBeenLastCalledWith(expect.objectContaining({renderer:{exposure:.9},cameraFog:{name:'off',params:{}}}));});
 test('offers only the original, studio, and publication choices',()=>expect(visualPresetOptions.map(x=>x.id)).toEqual(['default','studio','publication']));
});
