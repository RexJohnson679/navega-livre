/* Real Firefox DOM and native modality. This tests the repair module, not add-on installation. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const modules=process.env.NAVEGA_QA_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {firefox}=require(modules?modules+'/playwright':'playwright');
const modulePath=path.resolve(__dirname,'../notice-repair.js');
const html=`<!doctype html><html><head><style>
body{font:16px sans-serif}dialog{padding:0;border:1px solid gray;max-width:600px}dialog::backdrop{backdrop-filter:blur(6px);background:#0008}
.brand,.adblock-message,nav{padding:20px}nav{display:flex;gap:24px;border-top:1px solid gray}
</style></head><body style="overflow:hidden"><div id="background" inert aria-hidden="true"><main><h1>Conteúdo de leitura</h1><button id="normal">Ler capítulo</button></main></div>
<dialog id="gate"><div class="brand">Marca genérica</div><div class="adblock-message"><h2>Desative o bloqueador de anúncios</h2><p>Publicidade mantém o serviço disponível.</p><button id="retry">Verificar novamente</button><details><summary>Ajuda</summary>Mais instruções</details></div><nav><a href="/privacy">Privacidade</a><a href="/contact">Contato</a></nav></dialog>
<script>window.normalClicks=0;window.retryClicks=0;document.querySelector('#normal').onclick=()=>normalClicks++;document.querySelector('#retry').onclick=()=>retryClicks++;document.querySelector('#gate').showModal();</script></body></html>`;
async function run(browser,filename,baseline=false){
  const page=await browser.newPage();page.setDefaultTimeout(10000);
  try{
    await page.setContent(html);await page.bringToFront();
    assert.equal(await page.locator('#gate').evaluate(node=>node.matches(':modal')),true);
    await page.addScriptTag({content:fs.readFileSync(filename,'utf8')});
    const result=await page.evaluate(async()=>{window.repairEngine=NavegaNoticeRepair.create();return await repairEngine.run();});
    const snapshot=await page.evaluate(()=>({open:document.querySelector('#gate').open,modal:document.querySelector('#gate').matches(':modal'),
      bodyHidden:getComputedStyle(document.querySelector('.adblock-message')).display==='none',inert:document.querySelector('#background').inert,
      scroll:document.body.style.overflow,retryClicks}));
    if(baseline){assert.equal(snapshot.modal,true);console.log('BASELINE_REPRODUCED',JSON.stringify(snapshot));return;}
    assert.ok(result.repaired>0);assert.equal(snapshot.open,false);assert.equal(snapshot.modal,false);assert.equal(snapshot.inert,false);assert.equal(snapshot.scroll,'auto');assert.equal(snapshot.retryClicks,0);
    await page.locator('#normal').click();assert.equal(await page.evaluate(()=>normalClicks),1);
    await page.evaluate(()=>{document.querySelector('#background').inert=true;document.querySelector('#background').setAttribute('aria-hidden','true');document.body.style.overflow='hidden';document.querySelector('#gate').showModal();});
    await page.waitForFunction(()=>!document.querySelector('#gate').open && !document.querySelector('#background').inert && document.body.style.overflow==='auto');
    await page.locator('#normal').click();assert.equal(await page.evaluate(()=>normalClicks),2);
    const metrics=await page.evaluate(()=>repairEngine.diagnostics());assert.equal(metrics.timer,false);assert.ok(metrics.retained<=metrics.limits.retained);assert.ok(metrics.queued<=metrics.limits.scopes+1);
    await page.evaluate(()=>repairEngine.stop());
    assert.equal(await page.locator('#background').getAttribute('aria-hidden'),'true');assert.equal(await page.locator('#background').evaluate(node=>node.inert),true);
    console.log('PASS_FIREFOX_NATIVE_DIALOG',JSON.stringify({browser:browser.version(),result,snapshot,metrics}));
  }finally{await page.close();}
}
(async()=>{let browser;try{
  browser=await firefox.launch({headless:true,timeout:20000});
  if(process.env.NAVEGA_BASELINE_MODULE)await run(browser,path.resolve(process.env.NAVEGA_BASELINE_MODULE),true);
  await run(browser,modulePath);
}finally{await browser?.close();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
