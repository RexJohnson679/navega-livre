/* Real Firefox rendering at phone sizes with API fixtures; not an Android device test. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const modules=process.env.NAVEGA_QA_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {firefox}=require(modules?modules+'/playwright':'playwright');
const {prepare}=require('./renewal.firefox.e2e.cjs');
const sizes=[{width:320,height:640},{width:360,height:740},{width:412,height:850},{width:800,height:360}];
async function fits(page){
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,coarse:matchMedia('(pointer:coarse)').matches}));
  assert.ok(metrics.scroll<=metrics.width+1,JSON.stringify(metrics));
  assert.equal(metrics.coarse,true,'Touch context must activate mobile CSS');
}
(async()=>{let browser;try{
  browser=await firefox.launch({headless:true,timeout:25000});
  for(const viewport of sizes){
    const context=await browser.newContext({viewport,hasTouch:true});context.setDefaultTimeout(10000);
    try{
      await prepare(context,{platform:'android'});
      const page=await context.newPage();await page.goto('https://navega-ui.test/popup.html');
      await page.getByText('www.youtube.com',{exact:true}).waitFor();
      for(const name of ['general','youtube','repair','tools']){
        await page.locator('#tab-'+name).click();await fits(page);
        const button=await page.locator('#tab-'+name).boundingBox();assert.ok(button.height>=44);
      }
      for(const id of ['theme','settings','refresh']){const rect=await page.locator('#'+id).boundingBox();assert.ok(rect.width>=44&&rect.height>=44,id);}
      await page.locator('#linkInput').fill('https://example.test/read?id=4&utm_source=share');await page.locator('#cleanLink').click();
      assert.equal(await page.locator('#linkOutput').inputValue(),'https://example.test/read?id=4');await page.locator('#copyLink').click();
      assert.equal(await page.evaluate(()=>__copied.at(-1)),'https://example.test/read?id=4');
      await page.locator('#tab-youtube').click();await page.locator('#focusComments').check();await page.waitForFunction(()=>__state.preferences.focusComments);
      if(process.env.NAVEGA_QA_SCREENSHOTS){fs.mkdirSync(process.env.NAVEGA_QA_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.NAVEGA_QA_SCREENSHOTS,'android-popup-'+viewport.width+'.png'),fullPage:true});}
      await page.goto('https://navega-ui.test/options.html');await page.locator('#pausedList button').waitFor();await fits(page);
      await page.locator('#siteFilter').fill('news');assert.equal(await page.locator('#pausedList button').count(),1);
      await page.locator('#pausedList button').click();await page.waitForFunction(()=>__state.config.disabledHosts.length===0);await fits(page);
      console.log('PASS_MOBILE_UI',JSON.stringify({firefox:browser.version(),viewport,touch:true,scope:'real renderer; API fixtures'}));
    }finally{await context.close();}
  }
}finally{await browser?.close();}})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
