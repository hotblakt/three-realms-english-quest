import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
const viewport = process.env.FOREST_TABLET ? {width:1194,height:834} : {width:852,height:393};
const page=await browser.newPage({viewport,hasTouch:true,isMobile:true});
await page.route('**/forest-batch-b-preview/boot.ts*',async route=>{
 const response=await route.fetch();
 const body=(await response.text()).replace(/postBoot:\s*\(?game\)?\s*=>\s*\{/,'$& window.testGame = game;');
 await route.fulfill({response,body});
});
await page.goto((process.env.FOREST_DEV_ORIGIN??'http://localhost:4180')+'/forest-v3-preview/?renderer=canvas');
await page.waitForFunction(()=>window.testGame?.scene.getScene('misty-forest')?.loaded);
const state=()=>page.evaluate(()=>{
 const s=window.testGame.scene.getScene('misty-forest'), {x,y}=s.player.body.center;
 return {x,y,active:s.active, foes:s.enemyViews.size, previews:[...(s.encounterPreviews?.values()??[])].flatMap(({figures})=>figures).filter(v=>v.visible).length, phase:s.encounter.hud.phase,
  enemies:s.encounter.enemyState, swing:s.combatFeedback?.sword.visible??false, dodge:s.combatFeedback?.ghosts.some(v=>v.visible)??false};
});
const cdp=await page.context().newCDPSession(page);
const stick=await page.locator('#stick').boundingBox();
const move=async (dx,dy,axis,bound)=>{
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stick.x+stick.width*(.5+.32*dx),y:stick.y+stick.height*(.5+.32*dy),id:1}]});
 try{
  await page.waitForFunction(({axis,bound,sign})=>{
   const v=window.testGame.scene.getScene('misty-forest').player.body.center[axis];
   return sign*v>=sign*bound;
  },{axis,bound,sign:dx||dy},{timeout:12000});
 }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
};
const action=(action)=>page.locator('[data-action='+action+']').tap();
const start=await state();
assert.equal(start.y,766);
const effect=key=>page.waitForFunction(key=>{
 const s=window.testGame.scene.getScene('misty-forest');
 return key==='attack' ? s.combatFeedback.sword.visible : s.combatFeedback.ghosts.some(v=>v.visible);
},key,{timeout:2500});
const tapWithEffect=async key=>Promise.all([effect(key),action(key)]);
await tapWithEffect('attack');
await page.getByText('揮劍・收招中',{exact:true}).waitFor();
await tapWithEffect('dodge');
await page.waitForTimeout(250);
await move(0,-1,'y',677);
await move(1,0,'x',512);
await move(0,-1,'y',590);
await move(1,0,'x',548);
await move(0,-1,'y',584);
await page.waitForFunction(()=>window.testGame.scene.getScene('misty-forest').encounterPreviews.get('lantern-sprout').figures.some(v=>v.visible));
assert.equal((await state()).active,undefined);
assert.match(await page.locator('#forest-message').innerText(),/竹芽.*互動/);
await move(0,-1,'y',562);
console.log('approach',await state(),await page.locator('#forest-message').innerText());
if(process.env.FOREST_EVIDENCE_DIR) await page.screenshot({path:process.env.FOREST_EVIDENCE_DIR+'/lantern-approach.png'});
await action('interact');
await page.waitForFunction(()=>window.testGame.scene.getScene('misty-forest').active==='lantern-sprout');
console.log('entered',await state());
{
 await move(0,-1,'y',520);
 await tapWithEffect('dodge');
 await page.waitForTimeout(210);
 let slashInCombat = false;
 for(let i=0;i<15&&(await state()).phase==='active';i++){
  const current=await state();
  const enemy=current.enemies[0];
  if(!enemy?.health) break;
  const dx=enemy.position.x-current.x;
  const dy=enemy.position.y-current.y;
  const horizontal=Math.abs(dx)>Math.abs(dy);
  const axis=horizontal?'x':'y';
  const offset=horizontal?dx:dy;
  if(Math.abs(offset)>2) {
   const sign=Math.sign(offset);
   const stride=Math.min(Math.abs(offset) / 2,10);
   await move(horizontal?sign:0,horizontal?0:sign,axis,current[axis]+stride*sign);
  }
  if(!slashInCombat) {
   await tapWithEffect('attack');
   slashInCombat=true;
  } else await action('attack');
  await page.waitForTimeout(310);
 }
 await page.waitForFunction(()=>window.testGame.scene.getScene('misty-forest').encounter.hud.phase==='cleared',undefined,{timeout:2500});
 assert.equal((await state()).phase,'cleared',JSON.stringify(await state()));
 await page.getByRole('button',{name:'離開試煉'}).tap();
 await page.waitForFunction(()=>!window.testGame.scene.getScene('misty-forest').active);
 console.log('clear and retreat',await state());
}
}finally{await browser.close();}
