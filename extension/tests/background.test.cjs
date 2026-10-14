const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../common.js');
const P = require('../popup-policy.js');
async function workerFixture(options={}){
  let config=C.normalizeConfig(),rules=[],enabled=['advertising','privacy'],installed,message,changed,registered=options.registered||[];
  const scriptCalls=[],popupCalls=[],removed=[];
  const events={};
  const tabData=new Map([[7,{id:7,url:options.url||'https://example.test/path'}]]);
  const calls=[];const errors=[];
  const chrome={
    runtime:{getURL:p=>'chrome-extension://fixture/'+p,getManifest:()=>({version:C.FILTER_INFO.version}),onInstalled:{addListener:fn=>installed=fn},onStartup:{addListener(){}},onMessage:{addListener:fn=>message=fn}},
    storage:{local:{get:async()=>({config}),set:async data=>{config=data.config;changed?.({config:{newValue:config}},'local');}},onChanged:{addListener:fn=>changed=fn}},
    declarativeNetRequest:{getDynamicRules:async()=>rules,updateDynamicRules:async change=>{rules=change.addRules;calls.push(change);},updateEnabledRulesets:async change=>enabled=change.enableRulesetIds,getEnabledRulesets:async()=>{if(options.networkError)throw Error(options.networkError);return enabled;}},
    action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
    tabs:{get:async id=>tabData.get(id)||({id,url:options.url||'https://example.test/path'}),sendMessage:async()=>({noticesHidden:0}),
      remove:async id=>removed.push(id),onUpdated:{addListener:fn=>events.updated=fn},onRemoved:{addListener:fn=>events.removed=fn}},
    webNavigation:{onCreatedNavigationTarget:{addListener:fn=>events.created=fn},onBeforeNavigate:{addListener:fn=>events.navigate=fn}},
    scripting:{executeScript:async({func})=>[{result:vm.runInNewContext('('+func.toString()+')()',{
      ...(options.mainState?{__navegaLivreYoutubeState:()=>options.mainState}:{}),
      ...(options.popupState?{__navegaLivrePopupState:()=>options.popupState}:{})
    })}],getRegisteredContentScripts:async({ids})=>registered.filter(s=>ids.includes(s.id)),
      registerContentScripts:async scripts=>{
        if(options.registrationError)throw new Error(options.registrationError);
        for(const script of scripts){if(registered.some(s=>s.id===script.id))throw Error('Duplicate registration');
          (script.id==='navega-youtube-main'?scriptCalls:popupCalls).push('register');registered.push(script);}
      },
      updateContentScripts:async scripts=>{
        if(options.registrationError)throw new Error(options.registrationError);
        for(const script of scripts){const i=registered.findIndex(s=>s.id===script.id);if(i<0)throw Error('Missing registration');
          (script.id==='navega-youtube-main'?scriptCalls:popupCalls).push('update');registered[i]=script;}
      },
      unregisterContentScripts:async({ids})=>{for(const id of ids)(id==='navega-youtube-main'?scriptCalls:popupCalls).push('unregister');registered=registered.filter(s=>!ids.includes(s.id));}}
  };
  if(options.noUpdateApi)delete chrome.scripting.updateContentScripts;
  const context=vm.createContext({NavegaCore:C,NavegaPopupPolicy:P,importScripts(){},...(options.firefox ? {browser:chrome,chrome:{}} : {chrome}),console:{error:(...args)=>errors.push(args),warn(){}},URL});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  async function send(data,sender={url:'chrome-extension://fixture/popup.html'}){
    return new Promise(resolve=>message(data,sender,resolve));
  }
  return{send,installed,calls,scriptCalls,popupCalls,errors,events,removed,tabData,state:()=>({config,rules,enabled,registered})};
}
test('worker serializes settings, installs exact-host exceptions and disables network rules',async()=>{
  const f=await workerFixture();
  assert.equal((await f.send({type:'GET_CONFIG'})).ok,true);
  const pause=await f.send({type:'SET_SITE',tabId:7,enabled:false});
  assert.equal(pause.ok,true);assert.deepEqual([...f.state().config.disabledHosts],['example.test']);
  assert.equal(f.state().rules[0].action.type,'allowAllRequests');
  const re=new RegExp(f.state().rules[0].condition.regexFilter);
  assert.equal(re.test('https://example.test/page'),true);assert.equal(re.test('https://example.test.attacker.test/page'),false);
  await Promise.all([f.send({type:'SET_OPTION',key:'enabled',value:false}),f.send({type:'SET_OPTION',key:'skipAds',value:false})]);
  assert.equal(f.state().config.enabled,false);assert.equal(f.state().config.skipAds,false);assert.equal(f.state().enabled.length,0);
  assert.equal(f.state().registered.length,0);
  await f.send({type:'SET_SITE',tabId:7,enabled:true});assert.equal(f.state().rules.length,0);
  assert.equal(f.errors.length,0);
});
test('Firefox namespace enables real rule resources and the MAIN script at document start',async()=>{
  const f=await workerFixture({firefox:true});
  const result=await f.send({type:'GET_CONFIG'});
  assert.equal(result.network.available,true);assert.equal(result.network.error,null);
  assert.deepEqual([...result.network.enabledRulesets],['advertising','privacy']);
  assert.equal(f.state().registered[0].world,'MAIN');assert.equal(f.state().registered[0].runAt,'document_start');
  await f.send({type:'SET_OPTION',key:'privacy',value:false});
  assert.deepEqual([...f.state().enabled],['advertising']);
  assert.equal(f.state().config.enabled,true);
  assert.equal((await f.send({type:'SET_OPTION',key:'cosmetics',value:false})).config.cosmetics,false);
});
test('frame context only provides a top-level hostname to extension content scripts',async()=>{
  const f=await workerFixture();
  const result=await f.send({type:'FRAME_CONTEXT'},{tab:{id:7,url:'https://parent.example/path?token=secret'},frameId:3});
  assert.equal(result.host,'parent.example');assert.equal(JSON.stringify(result).includes('secret'),false);
  assert.equal((await f.send({type:'FRAME_CONTEXT'})).ok,false);
});
test('a network failure is visible in diagnostics without preventing the YouTube script from registering',async()=>{
  const f=await workerFixture({networkError:'Fixture network failure'});
  const result=await f.send({type:'GET_CONFIG'});
  assert.equal(result.network.error,'Fixture network failure');
  assert.equal(f.state().registered[0].world,'MAIN');
  assert.equal(f.errors.length,1);
});
test('content scripts cannot change preferences or request arbitrary injection',async()=>{
  const f=await workerFixture();
  const denied=await f.send({type:'SET_OPTION',key:'enabled',value:false},{tab:{id:7,url:'https://example.test/'},url:'https://example.test/'});
  assert.equal(denied.ok,false);assert.equal(f.state().config.enabled,true);
  assert.equal((await f.send({type:'SET_OPTION',key:'unknown',value:true})).ok,false);
  const known=await f.send({type:'KNOWN_REPAIR'},{tab:{id:7,url:'https://example.test/'}});
  assert.equal(known.repaired,false);
});
test('a native extension view opened in its own tab is trusted, while normal page tab senders are rejected',async()=>{
  const f=await workerFixture();
  assert.equal((await f.send({type:'GET_CONFIG'},{url:'chrome-extension://fixture/popup.html',tab:{id:10,url:'chrome-extension://fixture/popup.html'}})).ok,true);
  assert.equal((await f.send({type:'GET_CONFIG'},{url:'https://example.test/',tab:{id:7,url:'https://example.test/'}})).ok,false);
  assert.equal((await f.send({type:'GET_CONFIG'},{url:'chrome-extension://fixture/popup.html',tab:{id:7,url:'https://example.test/'}})).ok,false);
});
test('player diagnostic detects missing script and reports registration failures',async()=>{
  const f=await workerFixture({url:'https://www.youtube.com/watch',registrationError:'Fixture registration error'});
  const result=await f.send({type:'GET_YOUTUBE_DIAGNOSTIC',tabId:7});
  assert.equal(result.ok,true);assert.equal(result.main.installed,false);
  assert.equal(result.registration.active,false);assert.equal(result.registration.error,'Fixture registration error');
});
test('player diagnostic whitelists numeric counters and boolean state',async()=>{
  const f=await workerFixture({url:'https://www.youtube.com/watch',mainState:{installed:true,enabled:true,fetchMatched:3,xhrMatched:2,adFieldsRemoved:4,parseFailures:NaN,token:'fixture-secret'}});
  const result=await f.send({type:'GET_YOUTUBE_DIAGNOSTIC',tabId:7});
  assert.equal(result.main.installed,true);assert.equal(result.main.xhrMatched,2);assert.equal(result.main.parseFailures,0);
  assert.equal(JSON.stringify(result).includes('fixture-secret'),false);
});
const oldRegistration={id:'navega-youtube-main',matches:['*://www.youtube.com/*'],js:['youtube-main.js'],runAt:'document_idle',world:'ISOLATED'};
test('existing Chromium registration is updated using the documented updateContentScripts API',async()=>{
  const f=await workerFixture({registered:[oldRegistration],url:'https://www.youtube.com/watch'});
  const result=await f.send({type:'GET_YOUTUBE_DIAGNOSTIC',tabId:7});
  assert.equal(result.registration.active,true);assert.equal(result.registration.error,null);
  assert.deepEqual(f.scriptCalls,['update']);assert.equal(f.state().registered[0].world,'MAIN');
});
test('existing Firefox registration is updated using its documented API and repeat startup is harmless',async()=>{
  const f=await workerFixture({firefox:true,registered:[oldRegistration],url:'https://www.youtube.com/watch'});
  await f.send({type:'GET_CONFIG'});await f.installed();
  const result=await f.send({type:'GET_YOUTUBE_DIAGNOSTIC',tabId:7});
  assert.equal(result.registration.error,null);assert.equal(result.registration.active,true);
  assert.deepEqual(f.scriptCalls,['update']);
});
test('a browser without updateContentScripts replaces the old registration through supported APIs',async()=>{
  const f=await workerFixture({noUpdateApi:true,registered:[oldRegistration],url:'https://www.youtube.com/watch'});
  const result=await f.send({type:'GET_YOUTUBE_DIAGNOSTIC',tabId:7});
  assert.equal(result.registration.active,true);assert.equal(result.registration.error,null);
  assert.deepEqual(f.scriptCalls,['unregister','register']);
});
test('changing YouTube site scope updates the registered matches and unchanged settings do not re-register',async()=>{
  const f=await workerFixture({url:'https://www.youtube.com/watch'});
  await f.send({type:'GET_CONFIG'});
  await f.send({type:'SET_SITE',tabId:7,enabled:false});
  const result=await f.send({type:'GET_YOUTUBE_DIAGNOSTIC',tabId:7});
  assert.equal(result.registration.error,null);assert.deepEqual(f.scriptCalls,['register','update']);
  assert.ok(!f.state().registered[0].matches.includes('*://www.youtube.com/*'));
  await f.send({type:'SET_OPTION',key:'muteAds',value:true});await f.send({type:'GET_CONFIG'});
  assert.deepEqual(f.scriptCalls,['register','update']);
});
for(const firefox of [false,true]) {
  test(`${firefox?'Firefox':'Chromium'} closes only known advertising targets created by a protected source tab`,async()=>{
    const f=await workerFixture({firefox});await f.send({type:'GET_CONFIG'});
    f.tabData.set(10,{id:10,url:'https://demand.pubadx.one/click'});
    await f.events.created({sourceTabId:7,sourceFrameId:0,tabId:10,url:'https://demand.pubadx.one/click'});
    assert.deepEqual(f.removed,[10]);
    f.tabData.set(11,{id:11,url:'https://discord.gg/invite'});
    await f.events.created({sourceTabId:7,tabId:11,url:'https://discord.gg/invite'});
    f.tabData.set(12,{id:12,url:'https://popads.net/typed-by-user'});
    await f.events.navigate({tabId:12,frameId:0,url:'https://popads.net/typed-by-user'});
    assert.deepEqual(f.removed,[10],'Existing or manually opened tabs are never targets');
    const result=await f.send({type:'GET_POPUP_DIAGNOSTIC',tabId:7});assert.equal(result.tabsClosed,1);
  });
  test(`${firefox?'Firefox':'Chromium'} catches blank-popup redirects and respects paused sources and the popup toggle`,async()=>{
    const f=await workerFixture({firefox});await f.send({type:'GET_CONFIG'});
    f.tabData.set(10,{id:10,url:'about:blank'});
    await f.events.created({sourceTabId:7,tabId:10,url:'about:blank'});
    assert.equal(f.removed.length,0);
    f.tabData.set(10,{id:10,url:'https://popads.net/ad'});
    await f.events.updated(10,{url:'https://popads.net/ad'});assert.deepEqual(f.removed,[10]);
    await f.send({type:'SET_SITE',tabId:7,enabled:false});
    f.tabData.set(11,{id:11,url:'https://popads.net/ad'});
    await f.events.created({sourceTabId:7,tabId:11,url:'https://popads.net/ad'});assert.deepEqual(f.removed,[10]);
    const script=f.state().registered.find(s=>s.id==='navega-popup-main');
    assert.deepEqual([...script.excludeMatches],['*://example.test/*']);assert.equal(script.allFrames,true);
    assert.deepEqual([...script.js],['popup-main-bundle.js']);assert.equal(script.world,'MAIN');
    await f.send({type:'SET_SITE',tabId:7,enabled:true});
    await f.send({type:'SET_OPTION',key:'popups',value:false});
    assert.ok(!f.state().registered.some(s=>s.id==='navega-popup-main'));
    f.tabData.set(12,{id:12,url:'https://popads.net/ad'});
    await f.events.created({sourceTabId:7,tabId:12,url:'https://popads.net/ad'});assert.deepEqual(f.removed,[10]);
  });
}
test('popup diagnostics sanitize page data, and page senders cannot close tabs or read privileged diagnostics',async()=>{
  const f=await workerFixture({popupState:{installed:true,enabled:true,version:'0.4.0',popupsBlocked:4,linksBlocked:2,dialogsBlocked:Infinity,secret:'private-token'}});
  const result=await f.send({type:'GET_POPUP_DIAGNOSTIC',tabId:7});
  assert.equal(result.main.popupsBlocked,4);assert.equal(result.main.dialogsBlocked,0);
  assert.equal(JSON.stringify(result).includes('private-token'),false);
  assert.equal((await f.send({type:'GET_POPUP_DIAGNOSTIC',tabId:7},{tab:{id:7,url:'https://example.test/'}})).ok,false);
  assert.equal((await f.send({type:'CLOSE_TAB',tabId:7},{tab:{id:7,url:'https://example.test/'}})).ok,false);
  assert.equal(f.removed.length,0);
});
