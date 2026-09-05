import { test, expect } from '@playwright/test';
test('bundled molecule renders without desktop panels and responds to camera and resize', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Try Example' }).click();
  await expect(page.getByRole('main')).toHaveAttribute('data-loaded', 'true');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await expect(page.locator('.msp-plugin')).toHaveCount(0);
  await page.waitForTimeout(800);
  const before = await canvas.screenshot();
  await page.mouse.move(600, 400);
  await page.mouse.down();
  await page.mouse.move(750, 500, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await canvas.screenshot();
  expect(after.equals(before)).toBe(false);
  await page.screenshot({ path: 'test-results/spike-landscape.png' });
  await page.setViewportSize({ width: 700, height: 900 });
  await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(700);
  expect(errors).toEqual([]);
});

test('local mmCIF and PDB replace the example, malformed files recover', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Try Example' }).click();
  await expect(page.getByText(/46 residues · 327 atoms/)).toBeVisible();
  const picker = page.getByLabel('Open structure file');
  await picker.setInputFiles('public/examples/example.cif');
  await expect(page.getByText(/example.cif/)).toBeVisible();
  await picker.setInputFiles({ name: 'broken.cif', mimeType: 'text/plain', buffer: Buffer.from('not a structure') });
  await expect(page.getByRole('alert')).toContainText('Could not read');
  await expect(page.getByText(/example.cif/)).toBeVisible();
  await picker.setInputFiles({ name: 'small.pdb', mimeType: 'text/plain', buffer: Buffer.from('HEADER    TEST\nATOM      1  N   ALA A   1      11.104  13.207   9.000  1.00 20.00           N\nATOM      2  CA  ALA A   1      12.104  13.207   9.000  1.00 20.00           C\nATOM      3  C   ALA A   1      13.104  13.207   9.000  1.00 20.00           C\nEND\n') });
  await expect(page.getByText(/small.pdb/)).toBeVisible();
  await expect(page.getByText(/1 residues · 3 atoms/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('touch-sized controls fit portrait and split-screen widths', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveAttribute('data-ready', 'true');
  for (const width of [834, 600, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const button of await page.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.x).toBeGreaterThanOrEqual(0);
    }
  }
});
