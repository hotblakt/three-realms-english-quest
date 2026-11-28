const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
await page.addInitScript(()=>localStorage.setItem('three-realms:awakening-of-wind:v2','{"step":"complete"}'));
await page.route('**/forest-batch-b-preview/boot.ts*',async route=>{
 const response=await route.fetch();
 const original=await response.text();
 const source=original.replace(/postBoot:\s*\(?game\)?\s*=>\s*\{/,'$& window.__alphaTestGame = game;');
 await route.fulfill({response,body:source});
});
const origin = process.env.FOREST_DEV_ORIGIN ?? 'http://localhost:4180';
await page.goto(new URL('forest-v3-preview/?renderer=canvas', origin).href);
await page.waitForFunction(()=>window.__alphaTestGame?.scene.getScene('misty-forest')?.loaded);
const read=()=>page.evaluate(()=>{
 const s=window.__alphaTestGame.scene.getScene('misty-forest');
 const {x,y}=s.player.body.center;
 return {x,y,active:s.active,foes:s.encounter.enemyState.filter(e=>e.health),hud:s.encounter.hud,result:s.result};
});
const place=(x,y)=>page.evaluate(([x,y])=>{
 const s=window.__alphaTestGame.scene.getScene('misty-forest');
 s.player.body.reset(x,y);
},[x,y]);
const press=(key,delay=50)=>page.keyboard.press(key,{delay});
const toward=(s,t)=>{const dx=t.x-s.x,dy=t.y-s.y;return Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp')};
const act=async () => {
 const s=await read();
 const foe=s.foes[0];
 if(s.hud.phase==='failed') {
  await page.getByRole('button',{name:'再挑戰'}).click();
  await page.waitForTimeout(350);
  return;
 }
 if(!foe || s.hud.phase!=='active') return;
 const distance=Math.hypot(s.x-foe.position.x,s.y-foe.position.y);
 const facing=toward(s,foe.position);
 if(distance>42) {
  await press(facing,Math.min(250,Math.max(60,(distance-35)*7)));
  if(foe.phase==='telegraph')await press('Space');
 } else {
  await press(facing,45);
  if(foe.phase==='telegraph' && s.hud.health<5) {
   await press('Space'); await page.waitForTimeout(230);
  } else {
   await press(s.hud.windBladeReady && foe.id.startsWith('wind-seed')?'k':'j');
   await page.waitForTimeout(235);
  }
 }
};
await place(812,470); await press('e',100);
await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').active==='east-wind-pair');
let cycle=0;
while((await read()).hud.phase!=='cleared' && cycle++<95) await act();
console.log('east',await read());
assert.equal((await read()).hud.phase,'cleared');
await page.getByRole('button',{name:'離開試煉'}).click();
await place(1050,317); await press('e',100);
await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').active==='mosswood-guardian');
await page.keyboard.down('ArrowDown');
await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').player.body.center.y>382);
await page.keyboard.up('ArrowDown');
for(let i=0;i<160;i++){
 const s=await read();
 if(s.hud.phase==='cleared') break;
 if(s.hud.phase==='failed') { await act(); continue; }
 const foe=s.foes[0];
 if(!foe) { await page.waitForTimeout(100); continue; }
 if(foe.phase==='recovery') {
  const desired={x:1069,y:414};
  if(Math.hypot(s.x-desired.x,s.y-desired.y)>48){await act();continue;}
  await press(toward(s,desired),45);
  await press(s.hud.windBladeReady?'k':'j');
 }
 await page.waitForTimeout(200);
}
const guardian=await read();
console.log('guardian',guardian);
assert.equal(guardian.hud.phase,'cleared');
assert.equal(await page.evaluate(async()=>{
 const state=await window.__alphaTestGame.scene.getScene('misty-forest').save.load();
 return state.progress.rewardReceipts.filter(r=>r.rewardId==='guardian-badge').length;
}),1);
await browser.close();
