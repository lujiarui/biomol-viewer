import { expect, test } from 'vitest';
import { measurePoints } from '../../src/viewer/analysis';
import { parseScalarMapping } from '../../src/viewer/customColorTheme';

test('custom scalar parser accepts residue and atom values and rejects malformed rows',()=>{
 expect(parseScalarMapping('# value map\nA,10,0.25\nB 42 CA 0.9')).toEqual([
  {chain:'A',residue:10,value:0.25},{chain:'B',residue:42,atom:'CA',value:0.9}
 ]);
 expect(()=>parseScalarMapping('A,ten,1')).toThrow('line 1');
 expect(()=>parseScalarMapping('')).toThrow('at least one');
});

test('selection measurements calculate distance, angle, dihedral, radius and rigid RMSD',()=>{
 expect(measurePoints('distance',[[0,0,0],[3,4,0]]).value).toBeCloseTo(5);
 expect(measurePoints('angle',[[1,0,0],[0,0,0],[0,1,0]]).value).toBeCloseTo(90);
 expect(Math.abs(measurePoints('dihedral',[[1,0,0],[0,0,0],[0,1,0],[0,1,1]]).value)).toBeCloseTo(90);
 expect(measurePoints('radius',[[0,0,0],[4,0,0]]).value).toBeCloseTo(2);
 expect(measurePoints('rmsd',[[0,0,0],[1,0,0],[0,1,0],[5,2,1],[6,2,1],[5,3,1]]).value).toBeCloseTo(0,5);
 expect(()=>measurePoints('angle',[[0,0,0],[1,0,0]])).toThrow('at least 3');
});
