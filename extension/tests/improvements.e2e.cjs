/* Installed production package; controlled fixtures derived from the failure types. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const modules=process.env.NAVEGA_QA_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=require(modules?modules+'/playwright':'playwright');
const extension=path.resolve(process.env.NAVEGA_EXTENSION_DIR||path.join(__dirname,'..'));
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/improvements.html'),'utf8');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'navega-improvements-'));
(async()=>{let context;try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--no-sandbox','--disable-extensions-except='+extension,'--load-extension='+extension]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async()=>{await queue;await init();});
  await context.route(/^https?:\/\//,route=>route.fulfill({contentType:route.request().resourceType()==='document'?'text/html':'text/plain',headers:{'access-control-allow-origin':'*'},body:route.request().resourceType()==='document'?fixture:'normal resource'}));
  const page=await context.newPage();
  for(const host of ['lycantoons.com','vegitoons.black']) {
    await page.goto('https://'+host+'/');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#advert')).display==='none');
    assert.equal(await page.locator('#notice').isVisible(),true,'mixed notice must wait for opt-in');
    assert.equal(await page.locator('#reader').isVisible(),true);assert.equal(await page.locator('#login').isVisible(),true);
    assert.equal(await page.locator('#legitimate-download').isVisible(),true);
    assert.equal(await page.locator('#AdBillboard').isVisible(),false,'imported generic cosmetic selector');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#shadow-host').shadowRoot.querySelector('#shadow-ad')).display==='none');
    const tabId=await worker.evaluate(async host=>(await chrome.tabs.query({url:'https://'+host+'/*'}))[0].id,host);
    await worker.evaluate(async({tabId})=>{const result=await handle({type:'SET_REPAIR',tabId,enabled:true},{url:chrome.runtime.getURL('popup.html')});if(!result.ok)throw Error(result.error);},{tabId});
    await page.waitForFunction(()=>window.dismissed===1 && !document.querySelector('#notice'));
    assert.equal(await page.evaluate(()=>window.paid),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'auto');
    for(const url of ['https://nap5k.com/tag.min.js','https://n6wxm.com/vignette.min.js','https://metrics.icloud.com/','https://pagead2.googlesyndication.com/ad.js']) {
      const result=await page.evaluate(async url=>{try{return(await fetch(url)).status;}catch{return 'blocked';}},url);
      assert.equal(result,'blocked','native DNR must block '+url);
    }
    for(const url of ['https://cdn.jsdelivr.net/library.js','https://rr1.googlevideo.com/videoplayback'])assert.equal(await page.evaluate(async url=>(await fetch(url)).status,url),200);
    await worker.evaluate(async()=>{const {config}=await chrome.storage.local.get('config');await chrome.storage.local.set({config:{...config,cosmetics:false}});});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#AdBillboard')).display!=='none');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#shadow-host').shadowRoot.querySelector('#shadow-ad')).display==='flex');
    assert.equal(await page.locator('#advert').isVisible(),true);
    await worker.evaluate(async()=>{const {config}=await chrome.storage.local.get('config');await chrome.storage.local.set({config:{...config,cosmetics:true}});await queue;});
    console.log('PASS Chromium',host,'native opt-in dismiss, vignette, generic CSS, open shadow roots, native DNR, protected resources and reversal');
  }
  console.log('ALL IMPROVEMENT CHROMIUM TESTS PASSED');
}finally{await context?.close();fs.rmSync(profile,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
