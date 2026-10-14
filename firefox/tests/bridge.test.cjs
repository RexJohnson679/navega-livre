const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const C=require('../common.js');
test('early Firefox bridge republishes saved settings on MAIN readiness and storage changes',async()=>{
  let ready,changed;const events=[];
  const settings=C.normalizeConfig({youtube:false});
  const context=vm.createContext({NavegaCore:C,location:{hostname:'www.youtube.com'},chrome:{},
    browser:{storage:{local:{get:async()=>({config:settings})},onChanged:{addListener:fn=>changed=fn}}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    document:{addEventListener:(type,fn)=>ready=fn,dispatchEvent:event=>events.push(event)}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../youtube-bridge.js'),'utf8'),context);
  ready();assert.equal(events.length,0);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events[0].detail,'{"enabled":false}');
  ready();assert.equal(events.length,2);
  changed({config:{newValue:{...settings,youtube:true}}},'local');
  assert.equal(events.at(-1).detail,'{"enabled":true}');
  changed({config:{newValue:{...settings,youtube:true,disabledHosts:['www.youtube.com']}}},'local');
  assert.equal(events.at(-1).detail,'{"enabled":false}');
});
