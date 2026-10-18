/* Install the production Chromium package: no mocks of extension APIs or the DOM. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const modules=process.env.NAVEGA_QA_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=require(modules?modules+'/playwright':'playwright');
const extension=path.resolve(process.env.NAVEGA_EXTENSION_DIR||path.join(__dirname,'../../dist/chromium'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'navega-auto-repair-'));
const html=`<!doctype html><html><head><style>dialog::backdrop{backdrop-filter:blur(6px);background:#0008}</style></head><body style="overflow:hidden"><div id="root"><div id="background" inert aria-hidden="true" style="filter:blur(7px);pointer-events:none"><main id="reader">Conteúdo normal do capítulo<button id="normal">Ler</button></main>
<article>Exemplo de texto: disable adblock. Este artigo deve permanecer.</article></div>
<dialog id="notice"><div>Marca do site</div><div class="adblock-message"><h2>Desative seu <b>bloqueador</b> de anúncios</h2><p>para continuar</p></div><nav><a href="/privacy">Privacidade</a><a href="/contact">Contato</a></nav></dialog></div><script>window.normalClicks=0;document.querySelector('#normal').onclick=()=>normalClicks++;document.querySelector('#notice').showModal();</script></body></html>`;
(async()=>{let context;try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--no-sandbox','--disable-extensions-except='+extension,'--load-extension='+extension]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async()=>{await queue;await init();});
  await context.route('https://unknown-repair.example/**',route=>route.fulfill({contentType:'text/html',body:html}));
  const page=await context.newPage();await page.goto('https://unknown-repair.example/');
  await page.waitForFunction(()=>document.documentElement.hasAttribute('data-navega-livre-cosmetics'));
  assert.equal(await page.locator('#notice').isVisible(),true);
  assert.equal(await page.locator('#notice').evaluate(node=>node.matches(':modal')),true);
  const tabId=await worker.evaluate(async()=>(await chrome.tabs.query({url:'https://unknown-repair.example/*'}))[0].id);
  const repair=enabled=>worker.evaluate(async({tabId,enabled})=>handle({type:'SET_REPAIR',tabId,enabled},{url:chrome.runtime.getURL('popup.html')}),{tabId,enabled});
  const result=await repair(true);assert.equal(result.ok,true);assert.ok(result.page.noticesHidden>0);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#notice')).display==='none');
  assert.equal(await page.locator('#notice').evaluate(node=>node.matches(':modal')),false);
  assert.equal(await page.locator('#background article').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'auto');
  assert.equal(await page.evaluate(()=>document.querySelector('#background').inert),false);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#background')).filter),'none');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#background')).pointerEvents),'auto');
  await page.locator('#normal').click();assert.equal(await page.evaluate(()=>normalClicks),1);
  await page.evaluate(()=>{document.querySelector('#background').inert=true;document.body.style.overflow='hidden';document.querySelector('#notice').showModal();});
  await page.waitForFunction(()=>!document.querySelector('#notice').open && !document.querySelector('#background').inert);
  await page.evaluate(()=>{const node=document.createElement('section');node.id='later';node.style.cssText='position:fixed;inset:20%;z-index:9999;background:white';node.textContent='Adblock detected. Please turn it off.';document.body.appendChild(node);});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#later')).display==='none');
  await repair(false);assert.equal(await page.locator('#later').isVisible(),true);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#notice').matches(':modal'));
  assert.equal(await page.locator('#notice').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  assert.equal(await page.evaluate(()=>document.querySelector('#background').inert),true);
  assert.equal(await page.evaluate(()=>document.querySelector('#background').getAttribute('aria-hidden')),'true');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#background')).filter),'blur(7px)');
  console.log('PASS production Chromium: unknown domain, opt-in, split text, dynamic notice, untouched article, scroll/inert and undo.');
}finally{await context?.close();fs.rmSync(profile,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
