/* Actual background + focus module + Firefox DOM. Browser API primitives are local adapters.
   Full add-on installation remains covered by the separate installed-browser CI tests. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const modules=process.env.NAVEGA_QA_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {firefox}=require(modules?modules+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),C=require('../common.js'),T=require('../preferences.js'),P=require('../popup-policy.js');
const version=require('../package.json').version;
(async()=>{let browser;try{
  browser=await firefox.launch({headless:true,timeout:25000});const context=await browser.newContext();context.setDefaultTimeout(10000);
  const html=fs.readFileSync(path.join(root,'tests/fixtures/focus.html'),'utf8');
  await context.route(/https:\/\/(?:www|m)\.youtube\.com\//,route=>{
    const css=new URL(route.request().url()).pathname==='/navega-qa-focus.css';
    return route.fulfill({contentType:css?'text/css':'text/html',body:css?fs.readFileSync(path.join(root,'focus.css'),'utf8'):html});
  });
  let data={config:C.normalizeConfig(),preferences:T.normalize({focusComments:true})},message,rules=[],registered=[],sets=['advertising','privacy','privacyExtended'];
  const pages=new Map(),workerListeners=[],cssCalls=[];
  await context.exposeBinding('__qaFocusRead',()=>structuredClone(data));
  await context.addInitScript(()=>{window.__qaFocusListeners=[];window.browser={storage:{local:{get:()=>window.__qaFocusRead()},onChanged:{addListener:fn=>window.__qaFocusListeners.push(fn),removeListener:fn=>window.__qaFocusListeners=window.__qaFocusListeners.filter(x=>x!==fn)}}};});
  const desktop=await context.newPage(),mobile=await context.newPage();pages.set(7,desktop);pages.set(8,mobile);
  await desktop.goto('https://www.youtube.com/watch?v=fixture');await mobile.goto('https://m.youtube.com/watch?v=fixture');
  assert.equal(await desktop.evaluate(()=>typeof __navegaLivreFocusController),'undefined','Already-open tab starts without the new controller');
  if(process.env.NAVEGA_FOCUS_BASELINE){
    for(const file of ['common.js','preferences.js'])await desktop.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
    await desktop.addScriptTag({content:fs.readFileSync(process.env.NAVEGA_FOCUS_BASELINE,'utf8')});
    await desktop.waitForFunction(()=>document.querySelector('#navega-livre-focus'));
    assert.equal(await desktop.locator('#comments').isVisible(),true,'The old inline stylesheet is blocked by fixture CSP');
    console.log('BASELINE_FOCUS_INLINE_CSP_REPRODUCED');
  }
  const api={runtime:{getURL:p=>'moz-extension://qa/'+p,getManifest:()=>({version}),onInstalled:{addListener(){}},onStartup:{addListener(){}},onMessage:{addListener:fn=>message=fn}},
    storage:{local:{get:async()=>structuredClone(data),set:async values=>{
      const changes={};for(const [key,value]of Object.entries(values)){changes[key]={oldValue:data[key],newValue:value};data[key]=structuredClone(value);}
      for(const listener of workerListeners)listener(changes,'local');
      for(const page of pages.values())await page.evaluate(async changes=>{await Promise.all(__qaFocusListeners.map(fn=>fn(changes,'local')));},changes);
    }},onChanged:{addListener:fn=>workerListeners.push(fn)}},
    tabs:{get:async id=>({id,url:pages.get(id).url()}),query:async()=>[...pages].map(([id,page])=>({id,url:page.url()})),onUpdated:{addListener(){}},onRemoved:{addListener(){}}},
    declarativeNetRequest:{getDynamicRules:async()=>rules,updateDynamicRules:async change=>{rules=change.addRules;},getEnabledRulesets:async()=>sets,updateEnabledRulesets:async change=>{sets=[...sets.filter(x=>!change.disableRulesetIds.includes(x)),...change.enableRulesetIds];}},
    action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
    scripting:{getRegisteredContentScripts:async({ids})=>registered.filter(x=>ids.includes(x.id)),registerContentScripts:async list=>{registered.push(...list);},unregisterContentScripts:async({ids})=>{registered=registered.filter(x=>!ids.includes(x.id));},
      executeScript:async({target,files,func})=>{
        const page=pages.get(target.tabId);
        if(files){for(const file of files)await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});return[{result:null}];}
        return[{result:await page.evaluate('('+func.toString()+')()')}];
      },insertCSS:async({target,files,origin})=>{
        assert.deepEqual([...files],['focus.css']);assert.equal(origin,'user');cssCalls.push(target.tabId);
        await pages.get(target.tabId).addStyleTag({url:new URL('/navega-qa-focus.css',pages.get(target.tabId).url()).href});
      }}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),{browser:api,NavegaCore:C,NavegaTools:T,NavegaPopupPolicy:P,URL,importScripts(){},console});
  const send=value=>new Promise(resolve=>message(value,{url:'moz-extension://qa/popup.html'},resolve));
  await send({type:'GET_CONFIG'});
  for(const [key,selector]of [['focusComments','#comments-modern'],['focusShorts','#short-modern'],['focusRelated','#related-modern']]){
    const result=await send({type:'SET_FOCUS_OPTION',key,value:true,tabId:7});assert.equal(result.ok,true);
    if(result.focusSync.applied!==2)console.log('FOCUS_DEBUG',JSON.stringify(await send({type:'GET_FOCUS_DIAGNOSTIC',tabId:7})));
    assert.equal(result.focusSync.applied,2);
    await desktop.locator(selector).waitFor({state:'hidden'});
  }
  for(const page of pages.values())for(const selector of ['#comments','#comments-modern','#comments-mobile','#chat','#short-modern','#short-mobile','#related-modern','#related-mobile'])assert.equal(await page.locator(selector).isVisible(),false,selector);
  for(const selector of ['#normal','#header','#player','#normal-video'])assert.equal(await desktop.locator(selector).isVisible(),true,selector);
  assert.equal(await desktop.locator('#navega-livre-focus').count(),0,'Legacy inline style is retired');
  assert.deepEqual(cssCalls,[7,8],'Each tab receives CSS only once');
  assert.equal(await mobile.evaluate(()=>__qaFocusListeners.length),1,'Repeated injection does not add listeners');
  data.config=C.normalizeConfig({disabledHosts:['www.youtube.com']});
  await api.storage.local.set({config:data.config});
  assert.equal(await desktop.locator('#comments').isVisible(),true);assert.equal(await mobile.locator('#comments').isVisible(),false,'Exact-host pause');
  for(const key of ['focusComments','focusShorts','focusRelated'])await send({type:'SET_FOCUS_OPTION',key,value:false});
  for(const page of pages.values())for(const selector of ['#comments-modern','#short-modern','#related-modern'])assert.equal(await page.locator(selector).isVisible(),true);
  assert.deepEqual(cssCalls,[7,8]);
  console.log('PASS_FOCUS_APPLICATION_FIREFOX',JSON.stringify({browser:browser.version(),tabs:2,oldTabsRecovered:true,strictStyleCsp:true,modernAndMobile:true,cssInsertions:cssCalls.length,scope:'Actual background and focus code; browser API primitives adapted locally'}));
  await context.close();
}finally{await browser?.close();}})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
