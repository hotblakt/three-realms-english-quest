const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const origin=process.env.FOREST_DEV_ORIGIN ?? 'http://localhost:4180';
const evidence = process.env.FOREST_EVIDENCE_DIR ?? '/tmp/alpha-evidence';
await mkdir(evidence,{recursive:true});
const cases=[];
for(const [name, viewport, renderer, mobile] of [
 ['desktop',{width:1280,height:800},'canvas',false],['iphone',{width:852,height:393},'canvas',true],
 ['ipad',{width:1194,height:834},'webgl',true],
]){
 const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 const page=await context.newPage();
 const interact=()=>mobile ? page.locator('#actions [data-action=interact]').tap() : page.keyboard.press('e',{delay:180});
 await page.addInitScript(({deny}) => {
   window.SpeechRecognition=class extends EventTarget {
     start() {
       setTimeout(() => {
         if (deny) {
           const event = new Event('error');
           event.error = 'not-allowed';
           this.dispatchEvent(event);
         } else {
           const event = new Event('result');
           event.results = [{isFinal:true,length:1,0:{transcript:'Come with me.'}}];
           this.dispatchEvent(event);
           this.dispatchEvent(new Event('end'));
         }
       },100);
     }
     abort() {}
   };
   window.webkitSpeechRecognition=window.SpeechRecognition;
 }, {deny:mobile});
 const errors=[];
 const screenshotErrors=[];
 const capture=async label=>{
   try { await page.screenshot({path:evidence+'/'+name+'-'+label+'.png',timeout:8000}); }
   catch(error) { screenshotErrors.push(error.message); }
 };
 page.on('pageerror',e=>{errors.push(e.message);console.error(name,e);});
 await page.route('**/forest-batch-b-preview/boot.ts*',async route=>{
   const response=await route.fetch();
   const original=await response.text();
   const source=original.replace(/postBoot:\s*\(?game\)?\s*=>\s*\{/,'$& window.__alphaTestGame = game;');
   assert.notEqual(source,original);
   await route.fulfill({response,body:source});
 });
 const set=async(x,y)=>page.evaluate(([x,y])=>window.__alphaTestGame.scene.getScene('misty-forest').player.body.reset(x,y),[x,y]);
 const state=()=>page.evaluate(()=> {
   const s=window.__alphaTestGame.scene.getScene('misty-forest');
   const p=s.player.body.center;
   return {x:p.x,y:p.y,phase:s.encounter?.hud.phase,hp:s.encounter?.hud.health,enemies:s.encounter?.enemyState,
     active:s.active,companion:s.companion?.visible,draw:s.game.renderer.type};
 });
 const ready=async path=>{
   const start=performance.now();
   await page.goto(origin+path+'?renderer='+renderer);
   await page.waitForFunction(()=>document.querySelector('#startup-state')?.textContent.includes('已繪製'),{},{timeout:25000});
   if(path.includes('v3')) await page.waitForFunction(()=>window.__alphaTestGame?.scene.getScene('misty-forest')?.loaded);
   return Math.round(performance.now()-start);
 };
 const position=()=>page.evaluate(()=>{
   const body=window.__alphaTestGame.scene.getScene('misty-forest').player.body;
   return { x:body.center.x, y:body.center.y, blocked:body.blocked.right };
 });
 const walk=async(key,fn)=>{
   await page.keyboard.down(key);
   try { await page.waitForFunction(fn,undefined,{timeout:8000}); }
   finally { await page.keyboard.up(key); }
 };
 const checkCreek=async()=>{
   await set(622,451);
   await walk('ArrowRight',()=>window.__alphaTestGame.scene.getScene('misty-forest').player.body.center.x>=728);
   await set(728,451);
   await walk('ArrowLeft',()=>window.__alphaTestGame.scene.getScene('misty-forest').player.body.center.x<=622);
   const stops=[];
   for(const dodging of [false,true]){
     await set(590,481);
     assert.equal(await page.evaluate(()=>{
       const {player,obstacles}=window.__alphaTestGame.scene.getScene('misty-forest');
       const a=player.body;
       return obstacles.getChildren().some(({body:b})=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y);
     }),false);
     await page.keyboard.down('ArrowRight');
     try {
       if(dodging) {
         await page.keyboard.down('Space');
         try {
           await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').player.body.velocity.x>200);
         } finally { await page.keyboard.up('Space'); }
       }
       await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').player.body.blocked.right);
       const stop=await position();
       assert.ok(Math.abs(stop.x-612.34)<.1 && Math.abs(stop.y-481)<.1,JSON.stringify(stop));
       stops.push(stop.x);
     } finally { await page.keyboard.up('ArrowRight'); }
     if(dodging) await page.waitForTimeout(180);
   }
   return stops;
 };
 const base=await ready('/forest-preview/');
 const stableCreek=await checkCreek();
 const alpha=await ready('/forest-v3-preview/');
 const warm=await ready('/forest-v3-preview/');
 assert.equal(await page.locator('.forest-tools').isVisible(),false);
 if(mobile){
   const stick=await page.locator('#stick').boundingBox();
   const actions=await page.locator('#actions').boundingBox();
   const hud=await page.locator('#alpha-hud').boundingBox();
   assert(stick && actions && hud && hud.y+hud.height<actions.y,JSON.stringify({hud,actions}));
   const session=await context.newCDPSession(page);
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stick.x+stick.width*.8,y:stick.y+stick.height*.5}]});
   await page.waitForTimeout(175);
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert((await state()).x>480,JSON.stringify(await state()));
 }
 const alphaCreek=await checkCreek();
 console.error(name, renderer, 'creek:', stableCreek, alphaCreek);
 await set(197,440);
 await interact();
 await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').progress.treasures.includes('west-chest'));
 await set(920,145);
 await page.waitForFunction(() => document.querySelector('#forest-message')?.textContent.includes('神社旁有腳步聲'));
 await interact();
 const dialog=page.getByRole('dialog');
 await dialog.waitFor();
 await dialog.getByRole('button',{name:'開啟麥克風'}).click();
 if(mobile){
  await dialog.getByText('這次無法使用麥克風。可以重試或用輔助練習。').waitFor();
  await dialog.getByRole('button',{name:'完成輔助練習'}).click();
 }
 await dialog.waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').progress.companion.collected);
 await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').companion?.visible);
 await capture('shrine');
 await set(622,451);
 await page.evaluate(()=>{
   const scene=window.__alphaTestGame.scene.getScene('misty-forest');
   scene.paws={x:604,y:451};
   scene.trail=[];
 });
 await walk('ArrowRight',()=>window.__alphaTestGame.scene.getScene('misty-forest').player.body.center.x>=750);
 await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').paws.x>675);
 await set(812,470);
 await page.waitForFunction(() => document.querySelector('#forest-message')?.textContent.includes('橋東試煉・竹芽'));
 await interact();
 await page.waitForFunction(()=>window.__alphaTestGame.scene.getScene('misty-forest').active==='east-wind-pair');
 await walk('ArrowDown',()=>window.__alphaTestGame.scene.getScene('misty-forest').encounter.playerPosition.y>=496);
 for(let tries=0;tries<8&&(await state()).enemies[0].health===3;tries++){
  const player=await state(), foe=player.enemies[0];
  const dx=foe.position.x-player.x,dy=foe.position.y-player.y;
  const key=Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');
  await page.keyboard.press(key,{delay:60});
  if (mobile) await page.locator('#actions [data-action="attack"]').tap();
  else await page.keyboard.press('j',{delay:140});
  await page.waitForTimeout(280);
 }
 const combat=await state();
 assert(combat.enemies[0].health<3,JSON.stringify(combat));
 await capture('combat');
 await page.getByRole('button',{name:'安全撤退'}).click();
 await page.waitForFunction(()=>!window.__alphaTestGame.scene.getScene('misty-forest').active);
 await set(1085,260);
 await page.waitForFunction(() => document.querySelector('#forest-message')?.textContent.includes('原有捷徑'));
 await interact();
 await page.waitForFunction(() => {
  const point = window.__alphaTestGame.scene.getScene('misty-forest').player.body.center;
  return Math.hypot(point.x - 477, point.y - 766) < 3;
 });
 await ready('/forest-v3-preview/');
 const save=await page.evaluate(async()=> {
   const s=window.__alphaTestGame.scene.getScene('misty-forest');
   return await s.save.load();
 });
 assert.equal(save.english,mobile ? 'assisted' : 'recognized');
 assert.equal(save.checkpoint,'south-entry');
 assert.equal(save.progress.rewardReceipts.filter(r=>r.rewardId==='recruit').length,1);
 assert.equal(errors.length,0);
 cases.push({name,renderer,base,alpha,warm,stableCreek,alphaCreek,combat,screenshotErrors,treasure:save.progress.treasures,recruitment:save.english});
 await context.close();
}
console.log(JSON.stringify(cases,null,2));
await browser.close();
