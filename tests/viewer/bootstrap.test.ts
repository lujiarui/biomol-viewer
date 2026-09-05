import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
test('bundled example is mmCIF with atom coordinates', () => {
  const text = readFileSync(new URL('../../public/examples/example.cif', import.meta.url), 'utf8');
  expect(text).toContain('data_1CRN');
  expect(text).toContain('_atom_site.Cartn_x');
});
