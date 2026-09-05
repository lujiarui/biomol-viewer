import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('scenario shortcut and compact language control preserve Open workflow',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Biomol',exact:true})).toBeVisible();
 const language=page.getByRole('button',{name:'Language / 语言'});await expect(language).toHaveText('🇨🇳 中文');
 await page.setViewportSize({width:375,height:812});await page.screenshot({path:`test-results/biomol-narrow-${test.info().project.name}.png`});
 await page.getByRole('button',{name:'Examples by scenario',exact:true}).click();await expect(page.getByRole('region',{name:'Example gallery'})).toBeFocused();
 await page.getByText('Ubiquitin · 1UBQ',{exact:true}).click();await expect(page.getByRole('main')).toHaveAttribute('data-loaded','true');
 await page.getByRole('button',{name:'Open',exact:true}).click();await expect(page.getByRole('button',{name:'From this device…'})).toBeInViewport();await expect(page.getByPlaceholder('PDB ID, e.g. 4HHB')).toBeInViewport();await page.getByRole('button',{name:'Close open dialog'}).click();
 await language.click();await expect(language).toHaveText('🇺🇸 EN');
});
test('aligned nearby residues span files and exclude unchecked counterpart chains',async({page})=>{
 await page.goto('/');const picker=page.getByLabel('Open structure file');const buffer=await readFile('public/examples/example.cif');
 for(const name of ['reference.cif','mobile.cif']){await picker.setInputFiles({name,mimeType:'text/plain',buffer});await page.getByRole('heading',{name,exact:true}).waitFor();}
 await page.getByRole('button',{name:'Align',exact:true}).click();await page.getByRole('button',{name:'Quick align two files'}).click();await expect(page.getByRole('button',{name:'Alignment applied',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close superposition'}).click();await page.waitForTimeout(600);
 const sheet=page.getByRole('region',{name:'Residue selection'});
 for(const [x,y] of [[600,400],[550,400],[650,400],[600,350],[600,450],[550,350],[650,350],[550,450],[650,450],[500,400],[700,400]]){await page.mouse.click(x,y);if(await sheet.isVisible())break;}
 await expect(sheet).toBeVisible();await sheet.getByRole('button',{name:'Nearby atoms · 5 Å'}).click();await expect(sheet.getByRole('status')).toContainText('across 2 files');
 const other=(await sheet.locator('.selection-detail').innerText()).includes('reference.cif')?'mobile.cif':'reference.cif';
 await page.getByRole('button',{name:'Manage structures'}).click();const entry=page.locator('.scene-entry').filter({has:page.getByRole('checkbox',{name:other,exact:true})});const chain=entry.locator('.part-row input').first();await chain.uncheck();await expect(sheet.getByRole('status')).toHaveCount(0);await page.getByRole('button',{name:'Close structures panel'}).click();
 await sheet.getByRole('button',{name:'Nearby atoms · 5 Å'}).click();await expect(sheet.getByRole('status')).toContainText('across 1 file');
 await page.getByRole('button',{name:'Manage structures'}).click();await chain.check();await page.getByRole('button',{name:'Close structures panel'}).click();await sheet.getByRole('button',{name:'Nearby atoms · 5 Å'}).click();await expect(sheet.getByRole('status')).toContainText('across 2 files');await page.screenshot({path:`test-results/cross-file-atoms-${test.info().project.name}.png`});
});
