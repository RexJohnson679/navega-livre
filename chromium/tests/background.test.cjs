const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../common.js');
async function workerFixture(options={}){
  let config=C.normalizeConfig(),rules=[],enabled=['advertising','privacy'],installed,message,changed,registered=[];
  const calls=[];const errors=[];
  const chrome={
    runtime:{getURL:p=>'chrome-extension://fixture/'+p,onInstalled:{addListener:fn=>installed=fn},onStartup:{addListener(){}},onMessage:{addListener:fn=>message=fn}},
    storage:{local:{get:async()=>({config}),set:async data=>{config=data.config;changed?.({config:{newValue:config}},'local');}},onChanged:{addListener:fn=>changed=fn}},
    declarativeNetRequest:{getDynamicRules:async()=>rules,updateDynamicRules:async change=>{rules=change.addRules;calls.push(change);},updateEnabledRulesets:async change=>enabled=change.enableRulesetIds,getEnabledRulesets:async()=>{if(options.networkError)throw Error(options.networkError);return enabled;}},
    action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
    tabs:{get:async id=>({id,url:options.url||'https://example.test/path'}),sendMessage:async()=>({noticesHidden:0})},
    scripting:{executeScript:async({func})=>[{result:vm.runInNewContext('('+func.toString()+')()',options.mainState?{__navegaLivreYoutubeState:()=>options.mainState}:{})}],getRegisteredContentScripts:async()=>registered,
      registerContentScripts:async scripts=>{if(options.registrationError)throw new Error(options.registrationError);registered=scripts;},updateRegisteredContentScripts:async scripts=>registered=scripts,
      unregisterContentScripts:async()=>registered=[]}
  };
  const context=vm.createContext({NavegaCore:C,importScripts(){},...(options.firefox ? {browser:chrome,chrome:{}} : {chrome}),console:{error:(...args)=>errors.push(args),warn(){}},URL});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  async function send(data,sender={url:'chrome-extension://fixture/popup.html'}){
    return new Promise(resolve=>message(data,sender,resolve));
  }
  return{send,installed,calls,errors,state:()=>({config,rules,enabled,registered})};
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
