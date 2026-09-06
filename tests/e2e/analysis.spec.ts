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
 const residues=panel.locator('.sequence-residue');await expect(residues.first()).toBeVisible();await residues.nth(0).click();await residues.nth(1).click();await panel.getByRole('button',{name:'Distance'}).click();await expect(panel.locator('.measurement-result')).toContainText('Distance:');
 await panel.getByRole('button',{name:'Detect and annotate'}).click();await expect(panel.getByText(/Deposited site ·/).first()).toBeVisible();
 await panel.getByLabel('Detector').selectOption('interface-pair');await panel.getByRole('button',{name:'Detect and annotate'}).click();await expect(panel.getByText(/Interface ·/).first()).toBeVisible();
 await panel.getByLabel('Detector').selectOption('pocket-geometry');await panel.getByRole('button',{name:'Detect and annotate'}).click();await expect(panel.getByText('Geometry pocket candidate · Beta',{exact:true}).last()).toBeVisible();
 await panel.getByRole('button',{name:'Calculate interface area'}).click();await expect(panel.locator('.measurement-result')).toContainText('Interface area:');await expect(panel.locator('.measurement-result')).toContainText('1.4 Å probe');expect(Number((await panel.locator('.measurement-result strong').textContent())?.match(/[\d.]+/)?.[0])).toBeGreaterThan(0);
 await colorBy.selectOption('custom');await panel.getByLabel('Scalar values').fill('A,1,0\nA,2,1\nA,3,CA,0.5');await useColor('custom');
 await page.screenshot({path:`test-results/analysis-workspace-${test.info().project.name}.png`});expect(errors).toEqual([]);
});

test('purge is visually marked as destructive',async({page})=>{await page.goto('/');await page.getByLabel('Open structure file').setInputFiles('public/examples/example.cif');await page.getByRole('button',{name:'Manage structures'}).click();await expect(page.getByRole('button',{name:'Purge all structures'})).toHaveClass(/danger-button/);});

test('automatic annotation works when Safari local HTTP omits crypto.randomUUID',async({page})=>{await page.addInitScript(()=>{Object.defineProperty(Crypto.prototype,'randomUUID',{configurable:true,value:undefined});});await page.goto('/');await page.getByLabel('Open structure file').setInputFiles('public/examples/4HHB.cif');await page.getByRole('button',{name:'Analyze'}).click();const panel=page.getByRole('complementary',{name:'Structure analysis'});await panel.getByRole('button',{name:'Detect and annotate'}).click();await expect(panel.getByText(/Deposited site ·/).first()).toBeVisible();});

test('3D range mode is explicit and the sequence matrix stays compact',async({page})=>{
 await page.goto('/');await page.getByLabel('Open structure file').setInputFiles('public/examples/example.cif');await page.getByRole('button',{name:'Analyze'}).click();
 const panel=page.getByRole('complementary',{name:'Structure analysis'}),matrix=panel.getByLabel('Linked sequence'),range=panel.getByRole('button',{name:'Drag range on 3D'});
 await expect(matrix).toBeVisible();expect(await matrix.evaluate(el=>getComputedStyle(el).maxHeight)).toBe('220px');
 await range.click();await expect(range).toHaveAttribute('aria-pressed','true');await expect(page.locator('.viewer-canvas')).toHaveClass(/range-selecting/);await expect(panel.getByText('Camera rotation is paused.',{exact:false})).toBeVisible();
 await range.click();await expect(page.locator('.viewer-canvas')).not.toHaveClass(/range-selecting/);
});

test('dragging between two ribbon residues selects their sequence span',async({page})=>{
 test.setTimeout(90_000);await page.goto('/');await page.getByLabel('Open structure file').setInputFiles('public/examples/example.cif');
 const sheet=page.getByRole('region',{name:'Residue selection'}),points=new Map<string,{x:number;y:number}>();
 for(let y=260;y<=580&&points.size<2;y+=35)for(let x=280;x<=700&&points.size<2;x+=35){await page.mouse.click(x,y);if(await sheet.isVisible()){const label=await sheet.locator('h2').innerText();points.set(label,{x,y});await sheet.getByRole('button',{name:'Clear selection'}).click();}}
 expect(points.size).toBe(2);const [first,last]=[...points.values()];await page.getByRole('button',{name:'Analyze'}).click();await page.getByRole('button',{name:'Drag range on 3D'}).click();
 await page.mouse.move(first.x,first.y);await page.mouse.down();await page.mouse.move(last.x,last.y,{steps:8});await page.mouse.up();
 await expect(sheet).toBeVisible();await expect(sheet.locator('.eyebrow')).toContainText(/SELECTED RESIDUES/);
});
