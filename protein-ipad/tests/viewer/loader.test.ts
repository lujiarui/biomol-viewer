import { describe, expect, test } from 'vitest';
import { detectFormat } from '../../src/viewer/structureLoader';
describe('file format detection', () => {
  test.each([['x.pdb', 'pdb'], ['x.PDB', 'pdb'], ['name.v2.cif', 'mmcif'], ['x.mmcif', 'mmcif']])('%s → %s', (name, format) => expect(detectFormat(name)).toBe(format));
  test.each(['pdb', 'file', 'x.txt', 'x.cif.gz', 'x.bcif'])('rejects %s', name => expect(() => detectFormat(name)).toThrow('Choose a .pdb'));
});
