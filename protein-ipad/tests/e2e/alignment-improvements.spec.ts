import { unlink } from 'node:fs/promises';
import {test,expect} from '@playwright/test';
function pdb(chains:{id:string;count:number;mobile?:boolean;decoy?:boolean}[]){
 let serial=0;const lines=['HEADER    GEOMETRY TEST'];
 for(const chain of chains){for(let i=0;i<chain.count;i++){
  let x=3*Math.sin(i*.7)+i*.6,y=5*Math.cos(i*.4),z=i*1.2+2*Math.sin(i*.2);
  if(chain.decoy){x=i*.3;y=2*Math.sin(i*1.7);z=2*Math.cos(i*1.3);}
  if(chain.mobile){[x,y]=[-y+80,x-40];z+=30;}
  lines.push(`ATOM  ${String(++serial).padStart(5)}  CA  ${chain.mobile?'GLY':'ALA'} ${chain.id}${String(i+1).padStart(4)}    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00 20.00           C`);
 }lines.push('TER');}lines.push('END');return Buffer.from(lines.join('\n'));
}
test('geometry quick mode chooses matching chain, applies immediately, supports undo and purge',async({page})=>{
 await page.goto('/');const picker=page.getByLabel('Open structure file');
 await picker.setInputFiles({name:'reference.pdb',mimeType:'text/plain',buffer:pdb([{id:'A',count:18,decoy:true},{id:'B',count:18}])});await page.getByRole('heading',{name:'reference.pdb',exact:true}).waitFor();
 await page.getByRole('button',{name:'Align',exact:true}).click();const quick=page.getByRole('button',{name:'Quick align two files'});await expect(quick).toBeDisabled();
 await picker.setInputFiles({name:'mobile.pdb',mimeType:'text/plain',buffer:pdb([{id:'X',count:16,mobile:true}])});await page.getByRole('heading',{name:'mobile.pdb',exact:true}).waitFor();await expect(quick).toBeEnabled();await quick.click();
 await expect(page.getByRole('button',{name:'Alignment applied',exact:true})).toBeVisible();
 await expect(page.getByText(/Matched chain B → X from 2 compatible pairs/)).toBeVisible();
 await expect(page.getByRole('region',{name:'Alignment result'})).toContainText('16 Cα pairs');
 await page.getByRole('button',{name:'Preview fit',exact:true}).click();await expect(page.getByRole('region',{name:'Alignment result'})).toContainText('Before fit: 0.000 Å');
 await page.getByRole('button',{name:'Undo last alignment'}).click();await page.getByRole('button',{name:'Preview fit',exact:true}).click();await expect(page.getByRole('region',{name:'Alignment result'})).not.toContainText('Before fit: 0.000 Å');
 await page.getByRole('button',{name:'Manage structures'}).click();await page.getByRole('button',{name:'Purge all structures'}).click();await expect(page.getByRole('main')).toHaveAttribute('data-loaded','false');await expect(page.locator('.scene-entry')).toHaveCount(0);
 await page.getByRole('button',{name:'Close structures panel'}).click();await page.getByRole('button',{name:'Try Example'}).click();await expect(page.getByRole('main')).toHaveAttribute('data-loaded','true');
 await page.getByRole('button',{name:'Align',exact:true}).click();await expect(quick).toBeDisabled();await page.getByRole('button',{name:'Undo last alignment'}).click();await expect(page.getByRole('alert')).toContainText('No alignment to undo');
});
test('hold overlap is temporary and handles release, cancellation and short taps',async({page})=>{
 await page.goto('/');const picker=page.getByLabel('Open structure file');
 await picker.setInputFiles({name:'reference.pdb',mimeType:'text/plain',buffer:pdb([{id:'A',count:18}])});await page.getByRole('heading',{name:'reference.pdb',exact:true}).waitFor();
 await picker.setInputFiles({name:'mobile.pdb',mimeType:'text/plain',buffer:pdb([{id:'X',count:18,mobile:true}])});await page.getByRole('heading',{name:'mobile.pdb',exact:true}).waitFor();
 await page.getByRole('button',{name:'Align',exact:true}).click();await page.getByRole('combobox',{name:'Correspondence'}).selectOption('coordinates');await page.getByRole('button',{name:'Preview fit',exact:true}).click();const result=page.getByRole('region',{name:'Alignment result'});const original=await result.innerText();
 const hold=page.getByRole('button',{name:'Hold to preview overlap'});await hold.scrollIntoViewIfNeeded();await page.waitForTimeout(600);const canvas=page.locator('canvas').first();const before=await canvas.screenshot();
 const box=(await hold.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await expect(page.getByRole('button',{name:'Release to restore original pose'})).toHaveAttribute('aria-pressed','true');await page.waitForTimeout(600);
 const during=await canvas.screenshot();expect(during.equals(before)).toBe(false);await page.screenshot({path:`test-results/hold-preview-${test.info().project.name}.png`});
 await page.mouse.up();await expect(hold).toHaveAttribute('aria-pressed','false');await page.getByRole('button',{name:'Preview fit',exact:true}).click();expect(await result.innerText()).toBe(original);
 await hold.focus();await page.keyboard.down('Space');await page.waitForTimeout(100);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('Space');await expect(hold).toHaveAttribute('aria-pressed','false');
 await hold.click();await expect(hold).toHaveAttribute('aria-pressed','false');await page.getByRole('button',{name:'Preview fit',exact:true}).click();expect(await result.innerText()).toBe(original);
 await page.getByRole('button',{name:'Undo last alignment'}).click();await expect(page.getByRole('alert')).toContainText('No alignment to undo');
});

test('small pinch zoom changes camera distance gradually and settles',async({page,request})=>{
 const files:string[]=[];
 async function cameraDistance(){
  await page.getByRole('button',{name:'Export',exact:true}).click();const saving=page.waitForResponse(r=>r.url().endsWith('/api/exports')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save PNG to Mac'}).click();const response=await saving;expect(response.ok()).toBe(true);const saved=await response.json();files.push(saved.name,saved.name.replace('.png','.json'));const metadata=await (await request.get(saved.metadataUrl)).json();await page.getByRole('button',{name:'Close export'}).click();return Math.hypot(...metadata.camera.position.map((v:number,i:number)=>v-metadata.camera.target[i]));
 }
 try{
  await page.goto('/');await page.getByRole('button',{name:'Try Example'}).click();await expect(page.getByRole('main')).toHaveAttribute('data-loaded','true');await page.waitForTimeout(600);const before=await cameraDistance();
  await page.locator('canvas').first().evaluate(async element=>{
   const rect=element.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
   const send=(name:string,radius:number)=>{const touches=name==='touchend'?[]:[-1,1].map((side,i)=>({identifier:i,target:element,pageX:cx+side*radius,pageY:cy,clientX:cx+side*radius,clientY:cy}));const event=new Event(name,{bubbles:true,cancelable:true});for(const key of ['altKey','ctrlKey','metaKey','shiftKey'])Object.defineProperty(event,key,{value:false});Object.defineProperty(event,'touches',{value:touches});Object.defineProperty(event,'changedTouches',{value:touches});element.dispatchEvent(event);};
   send('touchstart',100);for(let i=1;i<=10;i++){send('touchmove',100+i);await new Promise(resolve=>setTimeout(resolve,20));}send('touchend',110);
  });
  await page.waitForTimeout(500);const after=await cameraDistance();expect(after/before).toBeGreaterThan(0.65);expect(after/before).toBeLessThan(0.95);await page.waitForTimeout(400);const settled=await cameraDistance();expect(settled/after).toBeCloseTo(1,2);
 }finally{for(const file of files)await unlink(`scene-exports/${file}`).catch(()=>{});}
});
