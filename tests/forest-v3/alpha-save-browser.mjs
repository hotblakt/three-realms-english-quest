const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const context=await browser.newContext();
const first=await context.newPage(), second=await context.newPage();
for (const page of [first,second]) await page.goto(process.env.FOREST_DEV_ORIGIN ?? 'http://localhost:4180/');
const prepare=page=>page.evaluate(async()=>{
 const {AlphaSave,alphaSlot,alphaDatabase}=await import('/forest-v3-preview/save.ts');
 return {AlphaSave:typeof AlphaSave,alphaSlot,alphaDatabase};
});
await prepare(first);
await first.evaluate(()=>localStorage.setItem('three-realms:awakening-of-wind:v1','complete'));
const projections=await first.evaluate(async()=>{
 const {AlphaSave}=await import('/forest-v3-preview/save.ts');
 const oldChapter=(await new AlphaSave().load()).progress.chapterWindBlade;
 localStorage.setItem('three-realms:awakening-of-wind:v2','{"step":"complete"}');
 const currentChapter=(await new AlphaSave().load()).progress.chapterWindBlade;
 return {oldChapter,currentChapter};
});
assert.deepEqual(projections,{oldChapter:false,currentChapter:true});
const reward=(page,proposal)=>page.evaluate(async proposal=>{
 const {AlphaSave,alphaSlot}=await import('/forest-v3-preview/save.ts');
 return await new AlphaSave().commit(alphaSlot,proposal);
},proposal);
const duplicate=await Promise.all([first,second].map(p=>reward(p,{kind:'treasure',landmarkId:'west-chest'})));
assert.deepEqual(duplicate.map(x=>x.status),['confirmed','confirmed']);
assert.ok(duplicate.every(x=>x.progress.seals===1&&x.progress.rewardReceipts.length===1));
const interrupted=await first.evaluate(async()=>{
 const {AlphaSave,alphaSlot}=await import('/forest-v3-preview/save.ts');
 const original=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(value,key) {
  const request=original.call(this,value,key);
  this.transaction.abort();
  return request;
 };
 let result;
 try {result=await new AlphaSave().commit(alphaSlot,{kind:'discover'});}
 finally {IDBObjectStore.prototype.put=original;}
 const state=await new AlphaSave().load();
 return {status:result.status,discovered:state.progress.companion.discovered,receipts:state.progress.rewardReceipts.length};
});
assert.deepEqual(interrupted,{status:'rejected',discovered:false,receipts:1});
assert.equal((await reward(second,{kind:'discover'})).status,'confirmed');
const corrupt=await first.evaluate(async()=>{
 const {AlphaSave,alphaSlot,alphaDatabase}=await import('/forest-v3-preview/save.ts');
 const db=await new Promise(resolve=>{
  const request=indexedDB.open(alphaDatabase);
  request.onsuccess=()=>resolve(request.result);
 });
 async function raw(mode,op) {
  const tx=db.transaction('slots',mode);
  const req=op(tx.objectStore('slots'));
  await new Promise(resolve=>{tx.oncomplete=resolve;});
  return req.result;
 }
 const checks=[];
 for(const record of [{version:7,data:'unknown'},{version:1,progress:'damaged'}]){
   await raw('readwrite',s=>s.put(record,alphaSlot));
   const result=await new AlphaSave().commit(alphaSlot,{kind:'discover'});
   checks.push([result.status,await raw('readonly',s=>s.get(alphaSlot))]);
 }
 return checks;
});
assert.deepEqual(corrupt,[['rejected',{version:7,data:'unknown'}],['rejected',{version:1,progress:'damaged'}]]);
assert.equal(await second.evaluate(()=>localStorage.getItem('three-realms:awakening-of-wind:v2')),'{"step":"complete"}');
console.log(JSON.stringify({projections,duplicates:{seals:duplicate[0].progress.seals,receipts:duplicate[0].progress.rewardReceipts.length},interrupted,corrupt}));
await browser.close();
