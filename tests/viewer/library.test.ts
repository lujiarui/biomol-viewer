import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, expect } from 'vitest';
import { listLibrary, readLibraryFile } from '../../server/library';
import { rcsbId } from '../../src/viewer/sources';
import { chainColors } from '../../src/viewer/representations';
test('Mac library exposes only structure files within the configured folder', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'protein-library-'));
  try {
    await mkdir(path.join(root, 'runs'));
    await writeFile(path.join(root, 'runs/model.cif'), 'data_model');
    await writeFile(path.join(root, 'secret.txt'), 'not shared');
    await symlink(path.join(root, 'secret.txt'), path.join(root, 'leak.pdb'));
    expect((await listLibrary(root)).map(f => f.name)).toEqual(['runs/model.cif']);
    expect((await readLibraryFile(root, 'runs/model.cif')).toString()).toBe('data_model');
    for (const name of ['../model.cif', '/etc/file.pdb', 'leak.pdb', 'secret.txt', 'runs/../../file.cif']) await expect(readLibraryFile(root, name)).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('RCSB IDs accept legacy and extended IDs but cannot inject URLs', () => {
  expect(rcsbId(' 4hhb ')).toBe('4HHB'); expect(rcsbId('pdb_00004hhb')).toBe('pdb_00004HHB');
  for (const id of ['', '../1crn', 'https://example.com', 'abcd', '1abc.cif']) expect(() => rcsbId(id)).toThrow();
});
test('presets distinguish chains and large complexes receive distinct colors', () => {
  for (const palette of ['vivid', 'pastel', 'accessible', 'ocean', 'sunset', 'forest', 'berry'] as const) {
    expect(new Set(chainColors(palette, 4)).size).toBe(4);
    expect(new Set(chainColors(palette, 64)).size).toBe(64);
    expect(chainColors(palette, 12)).toEqual(chainColors(palette, 64).slice(0, 12));
  }
  expect(chainColors('vivid', 4)).not.toEqual(chainColors('pastel', 4));
});
