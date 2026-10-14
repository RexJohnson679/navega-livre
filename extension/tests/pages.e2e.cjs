/* Installed Chromium extension; controlled reader/news/video sites, never real accounts. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const modules=process.env.NAVEGA_QA_MODULES || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=require(modules?modules+'/playwright':'playwright');
const ext=path.resolve(process.env.NAVEGA_EXTENSION_DIR || path.join(__dirname,'..'));
const html=fs.readFileSync(path.join(__dirname,'fixtures/sites.html'),'utf8').replaceAll('__PORT__','80');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'navega-pages-'));
(async()=>{
  let context;
  try {
    context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
      args:['--no-sandbox','--disable-extensions-except='+ext,'--load-extension='+ext]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    console.log('CHROMIUM',context.browser()?.version());
    await worker.evaluate(async()=>{
      for(let i=0;i<120;i++){
        if((await chrome.scripting.getRegisteredContentScripts({ids:['navega-popup-main']})).length)return;
        await new Promise(r=>setTimeout(r,25));
      }throw Error('Popup guard did not register');
    });
    // Never fulfill packaged chrome-extension:// scripts with fixture HTML.
    await context.route(/^https?:\/\//,route=>{
      const url=new URL(route.request().url());
      const body=url.pathname==='/normal'?'<p id="normal">Link normal aberto</p>':url.pathname==='/frame'?'<p>Iframe normal</p>':html;
      return route.fulfill({contentType:'text/html',body});
    });
    const page=await context.newPage();
    page.on('pageerror',error=>console.log('FIXTURE ERROR',error.message));
    page.on('console',message=>{if(message.type()==='error')console.log('FIXTURE CONSOLE',message.text());});
    const unexpectedDialogs=[];
    page.on('dialog',d=>{unexpectedDialogs.push(d.message());d.dismiss();});
    for(const host of ['reader.navega.test','news.navega.test','video.navega.test']) {
      await page.goto('https://'+host+'/');
      try {
        await page.waitForFunction(()=>typeof window.__navegaLivrePopupState==='function' && window.__navegaLivrePopupState().enabled,{},{timeout:10000});
      } catch(error) {
        console.log('GUARD DEBUG',await page.evaluate(()=>({origin:location.origin,guard:typeof window.__navegaLivrePopupState,
          state:typeof window.__navegaLivrePopupState==='function'?window.__navegaLivrePopupState():null,
          policy:typeof window.NavegaPopupPolicy,body:document.body?.textContent?.slice(0,120)})));
        console.log('REGISTRATION DEBUG',await worker.evaluate(async()=>({config:(await chrome.storage.local.get('config')).config,scripts:await chrome.scripting.getRegisteredContentScripts()})));
        throw error;
      }
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#floating')).display==='none');
      assert.equal(await page.locator('#reader').isVisible(),true);assert.equal(await page.locator('#header').isVisible(),true);
      assert.equal(await page.locator('#normalframe').isVisible(),true);assert.equal(await page.locator('#adframe').isVisible(),false);
      await page.waitForFunction(()=>window.automaticResult===null);
      for(const selector of ['#hijack','#background','#known-ad']){
        const before=context.pages().length;await page.locator(selector).click();
        assert.equal(await page.evaluate(()=>window.attackResult),null);assert.equal(context.pages().length,before);
      }
      await page.locator('#bait').click();assert.equal(await page.evaluate(()=>window.baitResult),false);
      assert.deepEqual(unexpectedDialogs,[]);
      await page.locator('#insert').click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#dynamic')).display==='none');
      await page.locator('#search').fill('capítulo');assert.equal(await page.locator('#search').inputValue(),'capítulo');
      const normalPromise=context.waitForEvent('page');await page.locator('#normal-link').click();
      const normal=await normalPromise;await normal.waitForLoadState();assert.equal(await normal.locator('#normal').isVisible(),true);await normal.close();
      const sharePromise=context.waitForEvent('page');await page.locator('#share').click();
      const share=await sharePromise;await share.waitForLoadState();await share.close();
      const before=context.pages().length;
      await page.locator('#veil').evaluate(node=>node.style.display='block');
      await page.mouse.click(20,20);assert.equal(context.pages().length,before);
      await page.locator('#veil').evaluate(node=>node.style.display='none');
      console.log('PASS',host,'floaters, banners, dynamic ads, frames, hijacked clicks, normal links/buttons and install bait');
    }
    const tabId=await worker.evaluate(async()=>(await chrome.tabs.query({url:'https://video.navega.test/*'}))[0].id);
    await worker.evaluate(async()=>{const {config}=await chrome.storage.local.get('config');await chrome.storage.local.set({config:{...config,disabledHosts:['video.navega.test']}});});
    await page.waitForFunction(()=>!window.__navegaLivrePopupState().enabled);
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#banner')).display!=='none');
    const popupPromise=context.waitForEvent('page');await page.locator('#background').click();
    const allowed=await popupPromise;await allowed.waitForLoadState();await allowed.close();
    assert.ok(tabId);console.log('PASS per-site pause restores popup behavior and cosmetics');
    console.log('ALL MULTISITE CHROMIUM TESTS PASSED');
  } finally {await context?.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
