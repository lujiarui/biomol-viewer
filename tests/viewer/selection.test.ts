import { beforeAll, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Structure, StructureElement } from 'molstar/lib/mol-model/structure';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { EmptyLoci } from 'molstar/lib/mol-model/loci';
import { residueFromLoci, residueRange } from '../../src/viewer/selection';
import { extractMetadata } from '../../src/viewer/structureLoader';
let structure: Structure;
beforeAll(async () => {
  const text = readFileSync(new URL('../../public/examples/example.cif', import.meta.url), 'utf8');
  const parsed = await CIF.parseText(text).run();
  if (parsed.isError) throw new Error(parsed.message);
  const trajectory = await trajectoryFromMmCIF(parsed.result.blocks[0]).run();
  structure = Structure.ofModel(trajectory.representative);
});
test('real parsed atom pick becomes a serializable residue and whole-residue loci', () => {
  const unit = structure.units[0];
  const picked = StructureElement.Loci(structure, [{ unit, indices: OrderedSet.ofSingleton(0 as StructureElement.UnitIndex) }]);
  const result = residueFromLoci(picked)!;
  expect(JSON.parse(JSON.stringify(result.residue))).toEqual({ modelId: '1', chainId: 'A', authChainId: 'A', residueNumber: 1, authResidueNumber: 1, residueName: 'THR' });
  expect(OrderedSet.size(result.loci.elements[0].indices)).toBe(7);
});
test('background and empty picks do not create residues', () => {
  expect(residueFromLoci(EmptyLoci)).toBeUndefined();
  expect(residueFromLoci(StructureElement.Loci(structure, []))).toBeUndefined();
});
test('metadata counts actual parsed residues and atoms', () => {
  expect(extractMetadata(structure, 'example.cif', 'mmcif')).toEqual({ fileName: 'example.cif', format: 'mmcif', atomCount: 327, residueCount: 46, chains: [{ chainId: 'A', authChainId: 'A', residueCount: 46 }] });
});
test('drag endpoints select an inclusive sequence-order range in either direction', () => {
  const sequence = [1, 2, 3, 4, 5].map(residueNumber => ({ modelId: '1', chainId: 'A', residueNumber, residueName: 'ALA' }));
  expect(residueRange(sequence, sequence[3], sequence[1]).map(r => r.residueNumber)).toEqual([2, 3, 4]);
  expect(residueRange(sequence, sequence[0], { ...sequence[2], chainId: 'B' })).toEqual([]);
});
