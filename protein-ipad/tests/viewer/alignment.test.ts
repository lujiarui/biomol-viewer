import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Structure } from 'molstar/lib/mol-model/structure';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { extractAlignmentChains, fitChains, regionAnchors } from '../../src/viewer/alignment';
import type { AlignmentChain, AlignmentRequest } from '../../src/viewer/alignment';
const request:AlignmentRequest={reference:{structureId:'a',chainId:'A'},mobile:{structureId:'b',chainId:'A'},pairing:'sequence'};
const positions:[number,number,number][]=[[0,0,0],[2,0,0],[0,3,0],[0,0,4],[2,3,4],[4,2,1]];
function chain():AlignmentChain{return {chainId:'A',authChainId:'A',kind:'protein',anchors:positions.map((position,i)=>({residue:{modelId:'1',chainId:'A',residueNumber:i+1,authResidueNumber:i+1,residueName:['ALA','CYS','ASP','GLU','PHE','GLY'][i]},code:'ACDEFG'[i],position:[...position]}))};}
describe('least-squares fit',()=>{
  test('recovers a known rotation and translation with a proper rotation',()=>{
    const a=chain(),b=chain(); b.anchors.forEach(x=>{const [x0,y,z]=x.position!;x.position=[-y+12,x0-5,z+8];});
    const r=fitChains(a,b,request); expect(r.matched).toBe(6);expect(r.rmsd).toBeLessThan(1e-6);expect(r.beforeRmsd).toBeGreaterThan(10);
    expect(Mat4.determinant(Mat4.fromArray(Mat4(),r.matrix,0))).toBeCloseTo(1,6);
    expect(r.pairs.every(p=>p.distance<1e-6)).toBe(true);
  });
  test('a reflection cannot be fitted as a zero-RMSD rotation',()=>{
    const a=chain(),b=chain();b.anchors.forEach(x=>x.position![0]*=-1);expect(fitChains(a,b,request).rmsd).toBeGreaterThan(0.5);
  });
  test('retains outliers rather than quietly trimming them',()=>{
    const b=chain();b.anchors[5].position![2]+=15;const r=fitChains(chain(),b,request);expect(r.matched).toBe(6);expect(r.rmsd).toBeGreaterThan(1);
  });
  test('restricts full-chain correspondence by one or both independently chosen regions',()=>{
    const a=chain(),b=chain();b.anchors.forEach(x=>{x.residue.authResidueNumber!+=100;x.residue.residueNumber+=100;});
    const r=fitChains(a,b,{...request,reference:{...request.reference,range:'2-5'}});expect(r.matched).toBe(4);expect(r.pairs[0].mobile.authResidueNumber).toBe(102);
    const both=fitChains(a,b,{...request,reference:{...request.reference,range:'2-5'},mobile:{...request.mobile,range:'103-105'}});expect(both.matched).toBe(3);expect(both.rmsd).toBeLessThan(1e-6);
  });
  test('captured discontiguous selection is matched using the original chain sequence',()=>{
    const a=chain(),b=chain();const residues=[a.anchors[0].residue,a.anchors[2].residue,a.anchors[4].residue];
    const r=fitChains(a,b,{...request,reference:{...request.reference,residues}});expect(r.pairs.map(p=>p.mobile.residueNumber)).toEqual([1,3,5]);
  });
  test('sequence alignment handles an insertion rather than shifting later pairs',()=>{
    const a=chain(),b=chain();b.anchors.splice(2,0,{code:'W',residue:{chainId:'A',residueNumber:22,residueName:'TRP'},position:[30,20,10]});
    const r=fitChains(a,b,request);expect(r.matched).toBe(6);expect(r.rmsd).toBeLessThan(1e-6);
  });
  test('missing backbone atoms are counted and excluded',()=>{
    const b=chain();b.anchors[1].position=undefined;const r=fitChains(chain(),b,request);expect(r.missingAnchors).toBe(1);expect(r.matched).toBe(5);
  });
  test('rejects insufficient, collinear, nonfinite, and incompatible pairs',()=>{
    const a=chain(),b=chain();expect(()=>fitChains(a,b,{...request,reference:{...request.reference,range:'1-2'}})).toThrow('At least 3');
    b.anchors.forEach((x,i)=>x.position=[i,0,0]);expect(()=>fitChains(a,b,request)).toThrow('collinear');
    b.anchors[0].position=[NaN,0,0];expect(()=>fitChains(a,b,request)).toThrow('Non-finite');
    b.kind='nucleic';expect(()=>fitChains(a,b,request)).toThrow('same polymer type');
  });
  test('ordered pairing requires equal region counts and reports its meaning',()=>{
    const a=chain();expect(()=>fitChains(a,chain(),{...request,pairing:'order',reference:{...request.reference,range:'1-3'}})).toThrow('equal');
    expect(fitChains(a,chain(),{...request,pairing:'order'}).warnings.join(' ')).toContain('not sequence homology');
  });
  test('author insertion codes are distinct and invalid captures are rejected',()=>{
    const a=chain();a.anchors[2].residue.insertionCode='A';expect(regionAnchors(a,{range:'3A'})).toHaveLength(1);expect(()=>regionAnchors(a,{range:'3'})).toThrow();
    expect(()=>regionAnchors(a,{residues:[{chainId:'B',residueNumber:1,residueName:'ALA'}]})).toThrow('outside');
  });
});
async function parsed(id:string){const result=await CIF.parseText(readFileSync(`public/examples/${id}.cif`,'utf8')).run();if(result.isError)throw new Error(result.message);return Structure.ofModel((await trajectoryFromMmCIF(result.result.blocks[0]).run()).representative);}
test('real ubiquitin pair uses 76 Cα correspondences and a plausible nonzero RMSD',async()=>{
  const a=extractAlignmentChains(await parsed('1UBQ'))[0],b=extractAlignmentChains(await parsed('1UBI'))[0];const r=fitChains(a,b,request);
  expect(r.matched).toBe(76);expect(r.identity).toBe(1);expect(r.rmsd).toBeGreaterThan(0.01);expect(r.rmsd).toBeLessThan(2);
});
test('gallery has actual homomer, heteromer, RNA, and DNA chain content',async()=>{
  expect(extractAlignmentChains(await parsed('1TIM')).filter(c=>c.kind==='protein').length).toBeGreaterThanOrEqual(2);
  expect(extractAlignmentChains(await parsed('4HHB')).filter(c=>c.kind==='protein')).toHaveLength(4);
  for(const id of ['1URN','1TUP']){const c=extractAlignmentChains(await parsed(id));expect(c.some(x=>x.kind==='protein')).toBe(true);expect(c.some(x=>x.kind==='nucleic')).toBe(true);expect(c.filter(x=>x.kind==='nucleic').every(x=>x.anchors.some(a=>a.position))).toBe(true);}
});
