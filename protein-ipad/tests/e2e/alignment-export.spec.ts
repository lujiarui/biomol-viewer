import { test, expect } from '@playwright/test';
import { readFile, unlink } from 'node:fs/promises';
import { examples } from '../../src/viewer/examples';
test('scenario gallery renders bundled protein, ligand, homomer, heteromer, RNA and DNA examples',async({page})=>{
  test.setTimeout(120_000);
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/');
  for(const example of examples){
    await page.getByRole('button',{name:'Open',exact:true}).click();
    await page.getByText(`${example.title} · ${example.id}`,{exact:true}).click();
    await expect(page.getByRole('heading',{name:`${example.id}.cif`,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Manage structures'}).click();
    if(example.id==='1URN'||example.id==='1TUP')await expect(page.getByRole('checkbox',{name:'DNA / RNA',exact:true})).toBeChecked();
    await page.getByRole('button',{name:'Remove',exact:true}).click();
    await page.getByRole('button',{name:'Close structures panel'}).click();
  }
});
test('chain fit applies the world transform, exports transparent PNG on Mac, and undo restores it',async({page,request})=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const outputs:string[]=[];
  try{
    await page.goto('/');await page.getByRole('button',{name:'Open',exact:true}).click();
    await page.getByText('Ubiquitin · 1UBQ',{exact:true}).click();
    await expect(page.getByRole('heading',{name:'1UBQ.cif',exact:true})).toBeVisible();
    const source=await readFile('public/examples/1UBI.cif','utf8');
    const columns=source.split('\n').filter(line=>line.startsWith('_atom_site.')).map(line=>line.trim().split(/\s/)[0]);
    const xi=columns.indexOf('_atom_site.Cartn_x'),yi=columns.indexOf('_atom_site.Cartn_y'),zi=columns.indexOf('_atom_site.Cartn_z');
    const moved=source.split('\n').map(line=>{if(!/^(ATOM|HETATM)\s/.test(line))return line;const parts=line.trim().split(/\s+/);const x=Number(parts[xi]),y=Number(parts[yi]);parts[xi]=(-y+150).toFixed(3);parts[yi]=(x-70).toFixed(3);parts[zi]=(Number(parts[zi])+35).toFixed(3);return parts.join(' ');}).join('\n');
    await page.getByLabel('Open structure file').setInputFiles({name:'moved-1UBI.cif',mimeType:'text/plain',buffer:Buffer.from(moved)});
    await expect(page.getByRole('heading',{name:'moved-1UBI.cif',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Align',exact:true}).click();
    const panel=page.getByRole('complementary',{name:'Superposition'});
    await expect(page.getByRole('heading',{name:'moved-1UBI.cif',exact:true})).toBeVisible();
    await panel.getByRole('button',{name:'Preview fit'}).click();
    const result=page.getByRole('region',{name:'Alignment result'});
    await expect(result).toContainText('76 Cα pairs');
    const beforeText=await result.innerText();const before=Number(/Before fit: ([\d.]+)/.exec(beforeText)![1]);
    await result.getByRole('button',{name:'Apply alignment',exact:true}).click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-busy','false');
    await panel.getByRole('button',{name:'Preview fit'}).click();
    const afterText=await result.innerText();const after=Number(/Before fit: ([\d.]+)/.exec(afterText)![1]);
    const rmsd=Number(/([\d.]+) Å RMSD/.exec(afterText)![1]);
    expect(after).toBeCloseTo(rmsd,2);expect(after).toBeLessThan(before);
    await page.screenshot({path:'test-results/superposition.png'});
    await panel.getByRole('button',{name:'Close superposition'}).click();
    await page.getByRole('button',{name:'Export',exact:true}).click();
    await expect(page.getByRole('checkbox',{name:'Transparent background'})).toBeChecked();
    const saving=page.waitForResponse(r=>r.url().endsWith('/api/exports')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Save PNG to Mac'}).click();
    const response=await saving;expect(response.ok()).toBe(true);const saved=await response.json();outputs.push(saved.name,saved.name.replace('.png','.json'));
    await expect(page.getByRole('status')).toContainText('Saved on Mac:');
    const image=page.getByAltText('Exported molecular scene');
    await expect(image).toBeVisible();
    const pixels=await image.evaluate(async(img:HTMLImageElement)=>{
      await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)opaque++;
      return {cornerAlpha:data[3],opaque,width:canvas.width,height:canvas.height};
    });
    expect(pixels.cornerAlpha).toBe(0);expect(pixels.opaque).toBeGreaterThan(1000);
    const png=await request.get(saved.url);expect(Buffer.from(await png.body()).equals(await readFile(`scene-exports/${saved.name}`))).toBe(true);
    const metadata=await (await request.get(saved.metadataUrl)).json();expect(metadata.alignment.report.matched).toBe(76);expect(metadata.transforms).toHaveLength(2);
    const anotherTab=await page.context().newPage();await anotherTab.goto('/');await anotherTab.getByRole('button',{name:'Export',exact:true}).click();await expect(anotherTab.getByRole('link',{name:saved.name,exact:true})).toBeVisible();await anotherTab.close();
    await page.getByRole('button',{name:'Close export'}).click();await page.getByRole('button',{name:'Align',exact:true}).click();
    await panel.getByRole('button',{name:'Undo last alignment'}).click();await expect(page.getByRole('main')).toHaveAttribute('aria-busy','false');
    await panel.getByRole('button',{name:'Preview fit'}).click();expect(Number(/Before fit: ([\d.]+)/.exec(await result.innerText())![1])).toBeCloseTo(before,2);
    expect(errors).toEqual([]);
  }finally{for(const name of outputs)await unlink(`scene-exports/${name}`).catch(()=>{});}
});
test('one-sided and two-sided custom regions have explicit correspondences',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Open',exact:true}).click();await page.getByRole('button',{name:'Load ubiquitin comparison pair'}).click();
  const panel=page.getByRole('complementary',{name:'Superposition'});await expect(page.getByRole('heading',{name:'1UBI.cif',exact:true})).toBeVisible();
  await panel.getByLabel('Reference region',{exact:true}).fill('2-20');await panel.getByRole('button',{name:'Preview fit'}).click();await expect(page.getByRole('region',{name:'Alignment result'})).toContainText('19 Cα pairs');
  await panel.getByLabel('Mobile region',{exact:true}).fill('5-10');await panel.getByRole('button',{name:'Preview fit'}).click();await expect(page.getByRole('region',{name:'Alignment result'})).toContainText('6 Cα pairs');
  await panel.getByRole('combobox',{name:'Correspondence'}).selectOption('order');await panel.getByRole('button',{name:'Preview fit'}).click();await expect(panel.getByRole('alert')).toContainText('equal residue counts');
  await panel.getByLabel('Reference region',{exact:true}).fill('1-6');await panel.getByRole('button',{name:'Preview fit'}).click();await expect(page.getByRole('region',{name:'Alignment result'})).toContainText('6 Cα pairs');
});

test.describe('captured touch regions',()=>{
  test.use({hasTouch:true});
  test('capture both counterparts, preserving them while panels close and reopen',async({page})=>{
    test.setTimeout(120_000);
    await page.goto('/');await page.getByRole('button',{name:'Try Example'}).click();await expect(page.getByRole('main')).toHaveAttribute('data-loaded','true');
    await page.getByRole('button',{name:'Manage structures'}).click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();await expect(page.locator('.scene-entry')).toHaveCount(2);await page.getByRole('button',{name:'Close structures panel'}).click();
    await page.getByRole('button',{name:'Align',exact:true}).click();const panel=page.getByRole('complementary',{name:'Superposition'});
    await panel.getByRole('checkbox',{name:'Tap to add/remove residues'}).check();await panel.getByRole('button',{name:'Pick residues on canvas'}).click();await page.waitForTimeout(400);
    const coordinates:[number,number][]=[];let count=0;
    for(let y=300;y<=520&&count<4;y+=30){for(let x=460;x<=740&&count<4;x+=30){coordinates.push([x,y]);await page.touchscreen.tap(x,y);const sheet=page.getByRole('region',{name:'Residue selection'});if(await sheet.isVisible()){const text=await sheet.innerText();count=Number(/(\d+) SELECTED RESIDUES/.exec(text)?.[1] || 1);}}}
    expect(count).toBeGreaterThanOrEqual(4);
    await page.getByRole('button',{name:'Align',exact:true}).click();
    await panel.getByRole('group',{name:'Reference',exact:true}).getByRole('button',{name:'Use current selection'}).click();
    await expect(panel.getByRole('group',{name:'Reference',exact:true})).toContainText(`Captured ${count} residues`);
    const referenceLabel=(await panel.getByRole('combobox',{name:'Reference structure',exact:true}).locator('option:checked').innerText()).replace(/^\d+\. /,'');
    await panel.getByRole('button',{name:'Pick residues on canvas'}).click();await page.getByRole('button',{name:'Clear selection',exact:true}).click();
    await page.getByRole('button',{name:'Manage structures'}).click();await page.getByRole('checkbox',{name:referenceLabel,exact:true}).uncheck();await page.getByRole('button',{name:'Close structures panel'}).click();
    for(const [x,y] of coordinates)await page.touchscreen.tap(x,y);
    await page.getByRole('button',{name:'Align',exact:true}).click();
    await expect(panel.getByRole('group',{name:'Reference',exact:true})).toContainText(`Captured ${count} residues`);
    await panel.getByRole('group',{name:'Mobile',exact:true}).getByRole('button',{name:'Use current selection'}).click();
    await expect(panel.getByRole('group',{name:'Mobile',exact:true})).toContainText('Captured');
    await panel.getByRole('button',{name:'Preview fit'}).click();await expect(page.getByRole('region',{name:'Alignment result'})).toContainText(`${count} Cα pairs`);
    await expect(panel.getByRole('alert')).toHaveCount(0);
  });
});

test('Mac export rejects cross-origin writes and path traversal',async({request})=>{
  const cross=await request.post('/api/exports',{headers:{Origin:'https://unrelated.example','X-Protein-Export':'1'},data:{image:'invalid',manifest:{}}});expect(cross.status()).toBe(403);
  const invalid=await request.post('/api/exports',{headers:{Origin:'http://localhost:5173','X-Protein-Export':'1'},data:{image:'data:text/html;base64,PGgxPg==',manifest:{}}});expect(invalid.status()).toBe(400);
  expect((await request.get('/api/exports/file?name=..%2Fpackage.json')).status()).toBe(400);
});
