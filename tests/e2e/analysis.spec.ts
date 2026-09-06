import { expect, test } from '@playwright/test';

test('property colors, linked sequence, annotations and measurements work together',async({page})=>{
 test.setTimeout(120_000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByLabel('Open structure file').setInputFiles('public/examples/4HHB.cif');await expect(page.getByRole('main')).toHaveAttribute('data-loaded','true');
 await page.getByRole('button',{name:'Analyze'}).click();const panel=page.getByRole('complementary',{name:'Structure analysis'});await expect(panel).toBeVisible();
 const colorBy=panel.getByLabel('Color by'),applyColor=panel.getByRole('button',{name:'Apply color mapping'});
 async function useColor(mapping:string){await colorBy.selectOption(mapping);await applyColor.click();await page.waitForTimeout(50);await expect(applyColor).toBeEnabled({timeout:30_000});}
 expect(await colorBy.locator('option').count()).toBe(8);const before=await page.locator('canvas').screenshot();await useColor('hydrophobicity');expect((await page.locator('canvas').screenshot()).equals(before)).toBe(false);
 for(const mapping of ['chain','element','aa-type','secondary','charge','confidence','hydrophobicity'])await useColor(mapping);
 const residues=panel.locator('.sequence-residue');await expect(residues.first()).toBeVisible();await residues.nth(0).click();await panel.getByRole('checkbox',{name:'Select multiple residues on canvas'}).check();await residues.nth(1).click();await panel.getByRole('button',{name:'Distance'}).click();await expect(panel.locator('.measurement-result')).toContainText('Distance:');
 await panel.getByLabel('Annotation type').selectOption('active-site');await panel.getByLabel('Annotation name').fill('Catalytic test');await panel.getByRole('button',{name:'Annotate selection'}).click();await expect(panel.getByText('Catalytic test',{exact:true})).toBeVisible();await expect(panel.getByText(/2 residues/)).toBeVisible();
 await panel.getByLabel('Annotation name').fill('');await panel.getByRole('button',{name:'Suggest ligand contacts'}).click();await expect(panel.getByText('Ligand-contact pocket',{exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Calculate interface area'}).click();await expect(panel.locator('.measurement-result')).toContainText('Interface area:');await expect(panel.locator('.measurement-result')).toContainText('1.4 Å probe');expect(Number((await panel.locator('.measurement-result strong').textContent())?.match(/[\d.]+/)?.[0])).toBeGreaterThan(0);
 await colorBy.selectOption('custom');await panel.getByLabel('Scalar values').fill('A,1,0\nA,2,1\nA,3,CA,0.5');await useColor('custom');
 await page.screenshot({path:`test-results/analysis-workspace-${test.info().project.name}.png`});expect(errors).toEqual([]);
});

test('purge is visually marked as destructive',async({page})=>{await page.goto('/');await page.getByLabel('Open structure file').setInputFiles('public/examples/example.cif');await page.getByRole('button',{name:'Manage structures'}).click();await expect(page.getByRole('button',{name:'Purge all structures'})).toHaveClass(/danger-button/);});
