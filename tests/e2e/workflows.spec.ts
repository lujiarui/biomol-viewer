import { test, expect } from '@playwright/test';
import { copyFile, unlink } from 'node:fs/promises';
test('RCSB complex, palettes, species controls and multiple files', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('https://files.rcsb.org/download/4HHB.cif', route => route.fulfill({ path: 'public/examples/4HHB.cif', contentType: 'text/plain' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByLabel('From RCSB PDB').fill('bad');
  await page.getByRole('button', { name: 'Fetch', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a PDB ID');
  await page.getByLabel('From RCSB PDB').fill('4hhb');
  await page.getByRole('button', { name: 'Fetch', exact: true }).click();
  await expect(page.getByRole('heading', { name: '4HHB.cif' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage structures' }).click();
  const panel = page.getByRole('complementary', { name: 'Structures' });
  await expect(panel.getByRole('checkbox', { name: /Protein · Chain/ })).toHaveCount(4);
  await expect(panel.getByRole('checkbox', { name: 'Ligands', exact: true })).toBeChecked();
  await expect(panel.getByRole('checkbox', { name: 'Water', exact: true })).not.toBeChecked();
  const oldColor = await panel.locator('.swatch').first().getAttribute('style');
  await panel.getByRole('button', { name: 'Pastel' }).click();
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
  await expect(panel.locator('.swatch').first()).not.toHaveAttribute('style', oldColor!);
  await panel.getByRole('checkbox', { name: /Protein · Chain A/ }).uncheck();
  await expect(panel.getByRole('checkbox', { name: /Protein · Chain A/ })).not.toBeChecked();
  await panel.getByRole('checkbox', { name: /Protein · Chain A/ }).check();
  await page.screenshot({ path: 'test-results/complex-panel.png' });
  await page.getByLabel('Open structure file').setInputFiles('public/examples/example.cif');
  await expect(panel.locator('.scene-entry')).toHaveCount(2);
  const first = panel.locator('.scene-entry').first();
  await first.getByRole('checkbox', { name: '4HHB.cif', exact: true }).uncheck();
  await expect(first.getByRole('checkbox', { name: /Protein · Chain A/ })).toBeDisabled();
  await first.getByRole('button', { name: 'Remove' }).click();
  await expect(panel.locator('.scene-entry')).toHaveCount(1);
  await expect(panel.getByRole('checkbox', { name: 'example.cif', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('protein visualization menu renders backbone, lines, space filling and surface', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Open structure file').setInputFiles('public/examples/example.cif');
  await expect(page.getByRole('main')).toHaveAttribute('data-loaded', 'true');
  await page.getByRole('button', { name: 'Manage structures' }).click();
  const representation = page.getByRole('combobox', { name: 'Representation', exact: true });
  expect(await representation.evaluate((select: HTMLSelectElement) => select.options.length)).toBe(7);
  let previous = await page.locator('canvas').screenshot();
  for (const mode of ['backbone', 'lines', 'spacefill', 'surface']) {
    await representation.selectOption(mode);
    await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
    await page.waitForTimeout(300);
    const current = await page.locator('canvas').screenshot();
    expect(current.equals(previous)).toBe(false);
    previous = current;
  }
  await page.screenshot({ path: `test-results/molecular-surface-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Language / 语言' }).click();
  await expect(page.getByRole('combobox', { name: '显示方式', exact: true }).locator('option:checked')).toHaveText('分子表面');
  expect(errors).toEqual([]);
});
test('professional presets, palette previews, unique colors and optional chain labels', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Open structure file').setInputFiles('public/examples/example.cif');
  await page.getByRole('button', { name: 'Manage structures' }).click();
  const panel = page.getByRole('complementary', { name: 'Structures' });
  await expect(panel.locator('.palette-choice')).toHaveCount(7);
  await expect(panel.locator('.palette-strip i')).toHaveCount(42);
  await panel.locator('.scene-entry').first().getByRole('button', { name: 'Duplicate' }).click();
  await expect(panel.locator('.scene-entry')).toHaveCount(2);
  await panel.locator('.scene-entry').first().getByRole('button', { name: 'Duplicate' }).click();
  await expect(panel.locator('.scene-entry')).toHaveCount(3);
  const colors = await panel.locator('.scene-entry .swatch').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).style.background));
  expect(new Set(colors).size).toBe(colors.length);
  const canvas = page.locator('canvas');
  const discussion = await canvas.screenshot();
  const preset=panel.getByLabel('Scene preset');
  await preset.selectOption('studio');await page.waitForTimeout(100);await expect(preset).toBeEnabled();
  const presentation = await canvas.screenshot();
  expect(presentation.equals(discussion)).toBe(false);
  await preset.selectOption('publication');await page.waitForTimeout(100);await expect(preset).toBeEnabled();
  await panel.getByRole('checkbox', { name: 'Show file and chain labels' }).check();
  await expect(page.locator('.chain-label')).toHaveCount(3);
  await expect(page.locator('.chain-label').first()).toContainText('example.cif');
  await page.screenshot({ path: `test-results/publication-labels-${test.info().project.name}.png` });
  expect(errors).toEqual([]);
});
test('Mac folder files open over the local server and refresh finds new outputs', async ({ page, request }) => {
  const name = `test-${Date.now()}.cif`;
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await copyFile('public/examples/example.cif', `shared-structures/${name}`);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('46 residues · 327 atoms')).toBeVisible();
    const selected = page.getByRole('region', { name: 'Residue selection' });
    for (const [x, y] of [[600, 400], [550, 400], [650, 400], [600, 350], [600, 450], [550, 350]]) {
      await page.mouse.click(x, y); if (await selected.isVisible()) break;
    }
    await selected.getByRole('button', { name: 'Nearby atoms · 5 Å' }).click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
    await copyFile('public/examples/4HHB.cif', `shared-structures/${name}`);
    await page.getByRole('button', { name: 'Manage structures' }).click();
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect(page.getByText('801 residues · 4,779 atoms')).toBeVisible();
    await expect(page.locator('.scene-entry')).toHaveCount(1);
    await page.getByLabel('Tap selects').selectOption('atom');
    expect(errors).toEqual([]);
    expect((await request.get('/api/library/file?name=..%2Fpackage.json')).status()).toBe(404);
    expect((await request.post('/api/library')).status()).toBe(405);
  } finally { await unlink(`shared-structures/${name}`).catch(() => {}); }
});

test('nearby side-chain atoms and atom-level focus', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open structure file').setInputFiles('public/examples/example.cif');
  await expect(page.getByRole('main')).toHaveAttribute('data-loaded', 'true');
  await page.waitForTimeout(500);
  const sheet = page.getByRole('region', { name: 'Residue selection' });
  async function pick() {
    for (let y = 300; y <= 500; y += 40) {
      for (let x = 450; x <= 730; x += 40) {
        await page.mouse.click(x, y);
        if (await sheet.isVisible()) return;
      }
    }
    await expect(sheet).toBeVisible();
  }
  await pick();
  await sheet.getByRole('button', { name: 'Nearby atoms · 5 Å' }).click();
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/sidechain-detail.png' });
  await page.getByRole('button', { name: 'Manage structures' }).click();
  await page.getByRole('combobox', { name: 'Representation', exact: true }).selectOption('atoms');
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Tap selects').selectOption('atom');
  await page.getByRole('button', { name: 'Close structures panel' }).click();
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.waitForTimeout(500);
  await pick();
  await expect(sheet.getByRole('heading')).toContainText(/ · [A-Z][A-Z0-9]* · Chain/);
  const before = await page.locator('canvas').screenshot();
  await sheet.getByRole('button', { name: 'Focus', exact: true }).click();
  await page.waitForTimeout(400);
  expect((await page.locator('canvas').screenshot()).equals(before)).toBe(false);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
