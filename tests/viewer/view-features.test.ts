import {expect,test} from 'vitest';
import {Vec3,Mat4} from 'molstar/lib/mol-math/linear-algebra';
import {bestView} from '../../src/viewer/bestView';
import {translate,localize} from '../../src/i18n';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {CIF} from 'molstar/lib/mol-io/reader/cif';
import {trajectoryFromMmCIF} from 'molstar/lib/mol-model-formats/structure/mmcif';
import {Structure,StructureElement,StructureSelection} from 'molstar/lib/mol-model/structure';
import {Script} from 'molstar/lib/mol-script/script';
import {MolScriptBuilder as MS} from 'molstar/lib/mol-script/language/builder';
import {StructureSelectionQueries as Q} from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import {visibleSubset,neighborhoodSearch} from '../../src/viewer/visibleAtoms';
test('view search reduces projection collisions and gives an orthonormal camera frame',()=>{
 const points:[number,number,number][]=Array.from({length:80},(_,i)=>[Math.sin(i)*.1,Math.cos(i)*.1,i*.5]);const r=bestView(points,1.4,Vec3.create(0,0,1),Vec3.create(0,1,0));
 expect(r.score).toBeLessThan(r.beforeScore*.5);expect(Vec3.dot(r.direction,r.up)).toBeCloseTo(0,8);expect(Vec3.magnitude(r.direction)).toBeCloseTo(1);expect(r.radius).toBeGreaterThan(19);expect(()=>bestView([],1,Vec3(),Vec3())).toThrow('No visible');
});
test('Chinese translations preserve scientific names and accessibility attributes',()=>{
 expect(translate('76 residues · 602 atoms','zh-CN')).toBe('76 个残基 · 602 个原子');expect(translate('geometry score 0.921 · 80% / 90% coverage','zh-CN')).toContain('覆盖率 80% / 90%');expect(translate('result_model_A.pdb','zh-CN')).toBe('result_model_A.pdb');
 expect(translate('Molecular surface','zh-CN')).toBe('分子表面');expect(translate('Space filling','zh-CN')).toBe('空间填充');
 expect(translate('Matched chain A → B from 4 compatible pairs. First file fixed; second file moved.','zh-CN')).toContain('从 4 个兼容链对中选中链 A → B');
 const html=renderToStaticMarkup(localize(createElement('button',{'aria-label':'Clear selection'},'Clear selection'),'zh-CN'));expect(html).toContain('aria-label="清除选择"');expect(html).toContain('>清除选择<');
});
test('neighborhood intersects checked components, excluding nearby water and unchecked chains',async()=>{
 const cif=await CIF.parseText(readFileSync('public/examples/4HHB.cif','utf8')).run();if(cif.isError)throw Error(cif.message);const structure=Structure.ofModel((await trajectoryFromMmCIF(cif.result.blocks[0]).run()).representative);
 const select=(expression:Parameters<typeof Script.getStructureSelection>[0])=>StructureSelection.unionStructure(Script.getStructureSelection(expression,structure));
 const chainA=select(MS.struct.modifier.intersectBy({0:Q.protein.expression,by:MS.struct.generator.atomGroups({'chain-test':MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_asym_id(),'A'])})}));
 const water=select(Q.water.expression),protein=select(Q.protein.expression);expect(water.elementCount).toBeGreaterThan(0);expect(protein.elementCount).toBeGreaterThan(chainA.elementCount);
 const selection=StructureElement.Loci.remap(StructureElement.Loci.all(chainA),structure);
 const allowed=visibleSubset(structure,[{visible:true,structure:chainA},{visible:false,structure:protein},{visible:false,structure:water}]);
 const result=StructureElement.Loci.toStructure(neighborhoodSearch(selection)(allowed));expect(result.elementCount).toBe(chainA.elementCount);
 const withWater=visibleSubset(structure,[{visible:true,structure:chainA},{visible:true,structure:water}]);expect(StructureElement.Loci.size(neighborhoodSearch(selection)(withWater))).toBeGreaterThan(result.elementCount);
 expect(StructureElement.Loci.size(neighborhoodSearch(selection)(visibleSubset(structure,[])))).toBe(0);
});

test('cross-file neighborhoods use current world coordinates, not residue IDs',async()=>{
 const cif=await CIF.parseText(readFileSync('public/examples/example.cif','utf8')).run();if(cif.isError)throw Error(cif.message);
 const source=Structure.ofModel((await trajectoryFromMmCIF(cif.result.blocks[0]).run()).representative);
 const independent=Structure.ofModel((await trajectoryFromMmCIF(cif.result.blocks[0]).run()).representative);
 const shift=Mat4.fromTranslation(Mat4(),Vec3.create(100,0,0));const moved=Structure.transform(independent,shift);
 const search=neighborhoodSearch(StructureElement.Loci.all(source));
 expect(StructureElement.Loci.size(search(independent))).toBe(source.elementCount);
 expect(StructureElement.Loci.size(search(moved))).toBe(0);
 const restored=Structure.transform(moved,Mat4.fromTranslation(Mat4(),Vec3.create(-100,0,0)));
 expect(StructureElement.Loci.size(search(restored))).toBe(source.elementCount);
});
