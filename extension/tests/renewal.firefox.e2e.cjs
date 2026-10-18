/* Real Firefox rendering and interactions, using local WebExtension API fixtures.
   This does not claim installation of the complete add-on or live-service coverage. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const modules=process.env.NAVEGA_QA_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {firefox}=require(modules?modules+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),C=require('../common.js'),T=require('../preferences.js');
const version=require('../package.json').version;
const screenshotDir=process.env.NAVEGA_QA_SCREENSHOTS;
function mockBrowser({config,preferences,version}){
  const listeners=[],tabListeners=[];
  window.__state={config,preferences};window.__requests=[];window.__copied=[];window.__optionsOpened=0;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copied.push(text)}});
  const target={id:7,url:'https://www.youtube.com/watch?v=video&utm_source=share#t=10'};
  window.browser={
    runtime:{getManifest:()=>({version,browser_specific_settings:{gecko:{id:'fixture'}}}),openOptionsPage:async()=>{window.__optionsOpened++;},sendMessage:async message=>{
      window.__requests.push(message);
      if(message.type==='GET_CONFIG')return{ok:true,config:window.__state.config,network:{available:true,enabledRulesets:['advertising','privacy','privacyExtended'],error:null}};
      if(message.type==='GET_FOCUS_DIAGNOSTIC')return{ok:true,focus:{supported:true,installed:true,active:true,cssLoaded:true}};
      if(message.type==='SET_FOCUS_OPTION'){await window.browser.storage.local.set({preferences:{...window.__state.preferences,[message.key]:message.value}});return{ok:true,preferences:window.__state.preferences,focusSync:{applied:1,failed:0}};}
      if(message.type==='GET_POPUP_DIAGNOSTIC')return{ok:true,expectedVersion:version,registration:{active:true},main:{installed:true,enabled:true,version,popupsBlocked:3,linksBlocked:1,dialogsBlocked:1},tabsClosed:1};
      if(message.type==='GET_YOUTUBE_DIAGNOSTIC')return{ok:true,expectedVersion:version,registration:{active:true},main:{installed:true,enabled:true,version,fetchMatched:2,xhrMatched:1,adFieldsRemoved:4}};
      if(message.type==='SET_OPTION'){window.__state.config[message.key]=message.value;return{ok:true,config:window.__state.config};}
      if(message.type==='SET_SITE'){window.__state.config.disabledHosts=message.enabled?[]:['www.youtube.com'];return{ok:true,config:window.__state.config};}
      if(message.type==='SET_REPAIR')return{ok:true,config:window.__state.config,page:{repair:{state:'repaired',repaired:1}}};
      if(message.type==='REMOVE_SITE_SETTING'){window.__state.config[message.list]=window.__state.config[message.list].filter(x=>x!==message.host);return{ok:true,config:window.__state.config};}
      if(message.type==='APPLY_BACKUP'){const data=window.NavegaTools.readBackup(message.text);await window.browser.storage.local.set(data);return{ok:true,...data};}
      return{ok:false,error:'Unexpected fixture request'};
    }},
    storage:{local:{get:async()=>structuredClone(window.__state),set:async data=>{
      const changes={};for(const [key,value]of Object.entries(data)){changes[key]={oldValue:window.__state[key],newValue:value};window.__state[key]=structuredClone(value);}
      for(const listener of listeners)listener(changes,'local');
    }},onChanged:{addListener:fn=>listeners.push(fn)}},
    tabs:{query:async()=>[target],get:async()=>target,sendMessage:async()=>({adsHidden:28,skipClicks:2}),reload:async()=>{},onUpdated:{addListener:fn=>tabListeners.push(fn)}}
  };
}
async function prepare(context){
  await context.route('https://navega-ui.test/**',async route=>{
    const rel=new URL(route.request().url()).pathname.slice(1),file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
    const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.md':'text/plain'};
    await route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
  });
  await context.addInitScript(mockBrowser,{config:C.normalizeConfig({disabledHosts:['news.example'],repairHosts:['read.example']}),preferences:T.normalize(),version});
}
async function popup(context){
  const page=await context.newPage();await page.setViewportSize({width:440,height:600});
  await page.goto('https://navega-ui.test/popup.html');
  await page.getByText('www.youtube.com',{exact:true}).waitFor();
  assert.equal(await page.locator('#version').textContent(),version);
  assert.equal(await page.locator('#popupCount').textContent(),'4');
  await page.locator('#tab-general').click();await page.locator('#tab-general').press('End');
  assert.equal(await page.locator('#tab-tools').getAttribute('aria-selected'),'true');
  await page.locator('#linkInput').fill('https://read.example/watch?v=123&utm_source=mail&fbclid=ad#chapter');
  await page.locator('#cleanLink').click();
  assert.equal(await page.locator('#linkOutput').inputValue(),'https://read.example/watch?v=123#chapter');
  assert.equal(await page.evaluate(()=>__copied.length),0);
  await page.locator('#copyLink').click();assert.equal(await page.evaluate(()=>__copied[0]),'https://read.example/watch?v=123#chapter');
  await page.locator('#linkInput').fill('https://read.example/?sig=keep&utm_source=keep');
  assert.equal(await page.locator('#linkPreview').isVisible(),false);
  await page.locator('#cleanLink').click();assert.equal(await page.locator('#linkOutput').inputValue(),'https://read.example/?sig=keep&utm_source=keep');
  await page.locator('#tab-youtube').click();await page.locator('#focusShorts').check();
  await page.waitForFunction(()=>__state.preferences.focusShorts===true);
  assert.equal(await page.evaluate(()=>__requests.some(x=>x.type==='SET_OPTION')),false);
  await page.locator('#theme').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.locator('#tab-general').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=440),true);
  if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,'popup-dark.png'),fullPage:true});}
  await page.locator('#theme').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,'popup-light.png'),fullPage:true});
  await page.locator('#settings').click();assert.equal(await page.evaluate(()=>__optionsOpened),1);
  // Leave the page idle: the panel must not keep waking the worker.
  const before=await page.evaluate(()=>__requests.length);await page.waitForTimeout(2300);
  assert.equal(await page.evaluate(()=>__requests.length),before);
  await page.close();return 'popup';
}
async function options(context){
  const page=await context.newPage();await page.setViewportSize({width:1100,height:900});
  await page.goto('https://navega-ui.test/options.html');await page.locator('#pausedList .site-item').waitFor();
  assert.equal(await page.locator('#pausedTotal').textContent(),'1');assert.equal(await page.locator('#repairTotal').textContent(),'1');
  await page.getByRole('button',{name:'Retomar proteção em news.example',exact:true}).click();
  await page.waitForFunction(()=>__state.config.disabledHosts.length===0);
  assert.equal(await page.locator('#repairTotal').textContent(),'1');
  const backup=T.createBackup(C.normalizeConfig({privacy:false,disabledHosts:['new.example'],repairHosts:['reader.example']}),{theme:'light',focusComments:true},version);
  await page.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.locator('#importPreview').waitFor();assert.equal(await page.evaluate(()=>__state.config.privacy),true);
  assert.match(await page.locator('#importOptions').textContent(),/Bloquear rastreadores: desligado/);
  await page.locator('#cancelImport').click();assert.equal(await page.evaluate(()=>__state.config.privacy),true);
  await page.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.locator('#applyImport').click();await page.waitForFunction(()=>__state.config.privacy===false&&__state.preferences.theme==='light');
  assert.equal(await page.locator('#pausedTotal').textContent(),'1');assert.equal(await page.locator('#focusComments').isChecked(),true);
  await page.locator('#importFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schema":99}')});
  await page.waitForFunction(()=>document.querySelector('#message').classList.contains('error'));
  assert.equal(await page.evaluate(()=>__state.config.privacy),false);assert.equal(await page.locator('#importPreview').isVisible(),false);
  if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,'options-light.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);
  await page.close();return 'preferences';
}
async function focus(browser){
  const context=await browser.newContext();
  await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><ytd-watch-flexy><ytd-comments id="comments">Comments</ytd-comments><div id="related">Related</div><video id="player"></video></ytd-watch-flexy><ytd-rich-shelf-renderer is-shorts>Shorts</ytd-rich-shelf-renderer><main id="normal">Normal content</main></body></html>'}));
  await context.addInitScript(mockBrowser,{config:C.normalizeConfig(),preferences:T.normalize({focusShorts:true,focusComments:true,focusRelated:true}),version});
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=fixture');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'focus.css'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'focus.js'),'utf8')});
  await page.waitForFunction(()=>document.documentElement.hasAttribute('data-navega-livre-focus-comments'));
  assert.equal(await page.locator('#comments').isVisible(),false);assert.equal(await page.locator('#related').isVisible(),false);
  assert.equal(await page.locator('ytd-rich-shelf-renderer').isVisible(),false);assert.equal(await page.locator('#normal').isVisible(),true);
  await page.evaluate(()=>browser.storage.local.set({preferences:{theme:'system',focusShorts:false,focusComments:false,focusRelated:false}}));
  assert.equal(await page.locator('#comments').isVisible(),true);assert.equal(await page.locator('#related').isVisible(),true);
  assert.equal(await page.locator('[data-navega-livre-focus-comments]').count(),0);await context.close();return 'youtube-focus';
}
(async()=>{let browser;try{
  browser=await firefox.launch({headless:true,timeout:25000});
  const context=await browser.newContext();context.setDefaultTimeout(10000);await prepare(context);
  const scenarios=[await popup(context),await options(context),await focus(browser)];
  console.log('PASS_RENEWAL_FIREFOX_UI',JSON.stringify({browser:browser.version(),scenarios,scope:'Real DOM and UI with local API fixtures; no complete add-on installation'}));
  await context.close();
}finally{await browser?.close();}})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
