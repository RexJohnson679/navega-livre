const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../common.js');
const T=require('../preferences.js');
const root=path.resolve(__dirname,'..');
async function fixture(options={}){
  const nodes=new Map(),requests=[],sent=[],copied=[];let lastBlob,resolveOption,preferences=T.normalize(),config=C.normalizeConfig(),network={available:true,enabledRulesets:['advertising','privacy'],error:null},opened=0,closed=0;
  class Node{
    constructor(){this.events={};this.attributes={};this.dataset={};this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.classes=new Set();this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
    setAttribute(key,value){this.attributes[key]=value;}
    addEventListener(type,fn){this.events[type]=fn;}
    focus(){this.focused=true;}
    select(){this.selected=true;}
    appendChild(){} remove(){} click(){this.events.click?.({target:this});}
  }
  for(const match of fs.readFileSync(path.join(root,'popup.html'),'utf8').matchAll(/id="([^"]+)"/g))nodes.set(match[1],new Node());
  const document={getElementById:id=>nodes.get(id),createElement:()=>new Node(),body:new Node(),documentElement:new Node(),hidden:false};
  class LocalURL extends URL{static createObjectURL(blob){lastBlob=blob;return'blob:fixture';}static revokeObjectURL(){}}
  const api={storage:{local:{get:async()=>({preferences}),set:async data=>{if(options.storageError)throw Error('Storage fixture failure');preferences=data.preferences;}}},runtime:{getPlatformInfo:async()=>{if(options.platformError)throw Error('Platform unavailable');return{os:options.platform||'linux'};},openOptionsPage:async()=>{opened++;},getManifest:()=>({version:C.FILTER_INFO.version,browser_specific_settings:{gecko:{id:'fixture'}}}),sendMessage:async message=>{
    requests.push(message);
    if(message.type==='GET_CONFIG')return{ok:true,config,network};
    if(message.type==='GET_FOCUS_DIAGNOSTIC')return{ok:true,focus:{supported:true,installed:true,active:true,cssLoaded:true,...preferences}};
    if(message.type==='SET_FOCUS_OPTION'){if(options.storageError)throw Error('Storage fixture failure');preferences=T.normalize({...preferences,[message.key]:message.value});return{ok:true,preferences,focusSync:{applied:1,failed:0}};}
    if(message.type==='GET_POPUP_DIAGNOSTIC')return{ok:true,expectedVersion:C.FILTER_INFO.version,registration:{active:true,error:null},main:{installed:true,enabled:true,version:C.FILTER_INFO.version,popupsBlocked:2,linksBlocked:1,dialogsBlocked:1},tabsClosed:1};
    if(message.type==='SET_OPTION'){if(options.deferOption)await new Promise(resolve=>resolveOption=resolve);config=C.normalizeConfig({...config,[message.key]:message.value});return{ok:true,config};}
    if(message.type==='SET_REPAIR'){if(options.repairError)throw Error('Repair unavailable');return{ok:true,config,known:false,page:options.repairPage||{noticesHidden:0,repair:{state:'not-found',repaired:0}}};}
    if(message.type==='GET_YOUTUBE_DIAGNOSTIC')return{ok:true,expectedVersion:C.FILTER_INFO.version,registration:{active:true,error:null},main:{version:options.mainVersion||C.FILTER_INFO.version,installed:true,enabled:true,fetchMatched:1,xhrMatched:2,adFieldsRemoved:3}};
    return{ok:false,error:'Unexpected fixture message'};
  }},tabs:{get:async()=>({id:7,url:options.url||'https://www.youtube.com/watch?token=private#private'}),query:async()=>[{id:7,url:options.url||'https://www.youtube.com/watch?token=private#private'}],sendMessage:async(...args)=>{sent.push(args);return{adsHidden:2,skipClicks:1};},reload:async()=>{}}};
  const context=vm.createContext({NavegaCore:C,NavegaTools:T,browser:api,chrome:{},document,URL:LocalURL,Blob,navigator:{clipboard:{writeText:async value=>{if(options.clipboardError)throw Error('Denied');copied.push(value);}}},window:{close(){closed++;}},setInterval(){throw Error('No polling expected');},setTimeout(){},console});
  vm.runInContext(fs.readFileSync(path.join(root,'popup.js'),'utf8'),context);
  const flush=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));};
  await flush();
  return{nodes,requests,sent,copied,flush,preferences:()=>preferences,opened:()=>opened,closed:()=>closed,finishOption:()=>resolveOption?.(),blob:()=>lastBlob,networkError:error=>network={...network,error}};
}
test('Firefox popup uses promise APIs, reads the main frame and keeps tabs keyboard accessible',async()=>{
  const f=await fixture();
  assert.equal(f.nodes.get('hostname').textContent,'www.youtube.com');
  assert.equal(f.nodes.get('panel-youtube').hidden,false);assert.equal(f.nodes.get('tab-youtube').attributes['aria-selected'],'true');
  assert.equal(f.sent[0][2].frameId,0);assert.match(f.nodes.get('youtubeState').textContent,/Filtro carregado/);
  assert.match(f.nodes.get('networkState').textContent,/Rede carregada/);
  f.nodes.get('tab-youtube').events.keydown({key:'ArrowRight',preventDefault(){}});
  assert.equal(f.nodes.get('tab-repair').attributes['aria-selected'],'true');assert.equal(f.nodes.get('tab-repair').focused,true);
  const youtube=f.nodes.get('youtube');youtube.checked=false;youtube.events.change({target:youtube});await f.flush();
  assert.equal(f.nodes.get('skipAds').disabled,true);assert.equal(f.nodes.get('muteAds').disabled,true);
});
test('diagnostic omits private URL paths and parameters and includes a real network failure',async()=>{
  const f=await fixture({url:'https://example.test/private-chapter-id?token=private#private'});
  f.networkError('Fixture network failure');f.nodes.get('report').click();await f.flush();
  const report=JSON.parse(await f.blob().text());
  assert.equal(report.page,'https://example.test');assert.equal(report.target,'firefox');
  assert.equal(report.network.error,'Fixture network failure');assert.equal(report.filters.totalDomains,C.FILTER_INFO.totalDomains);
  assert.equal(JSON.stringify(report).includes('private-chapter-id'),false);assert.equal(JSON.stringify(report).includes('token=private'),false);
  assert.match(f.nodes.get('networkState').textContent,/Falha no bloqueio de rede/);
});
test('the panel identifies an old player script still present in an existing tab',async()=>{
  const f=await fixture({mainVersion:'0.3.0'});
  assert.match(f.nodes.get('youtubeState').textContent,/ainda usa o filtro 0\.3\.0/);
  assert.match(f.nodes.get('youtubeState').textContent,/abra uma nova/);
  assert.equal(f.nodes.get('youtubeState').classes.has('error'),true);
  assert.equal(f.nodes.get('version').textContent,C.FILTER_INFO.version);
});
test('a checkbox keeps the user-selected value while its native preference request is pending',async()=>{
  const f=await fixture({deferOption:true});
  const checkbox=f.nodes.get('popups');checkbox.checked=false;
  checkbox.events.change({target:checkbox});
  assert.equal(checkbox.disabled,true);assert.equal(checkbox.checked,false);
  f.finishOption();await f.flush();assert.equal(checkbox.disabled,false);assert.equal(checkbox.checked,false);
});
test('the repair button shows analysis progress and distinguishes this attempt from old counters',async()=>{
  const f=await fixture({repairPage:{noticesHidden:20,repair:{state:'not-found',repaired:0}}});
  f.nodes.get('repair').click();assert.match(f.nodes.get('message').textContent,/Analisando/);
  await f.flush();assert.match(f.nodes.get('message').textContent,/Nenhum aviso reconhecido agora/);
  assert.equal(f.nodes.get('repair').disabled,false);
});
test('the repair panel reports local repair and a bounded scan without claiming universal success',async()=>{
  const done=await fixture({repairPage:{repair:{state:'repaired',repaired:1}}});done.nodes.get('repair').click();await done.flush();
  assert.match(done.nodes.get('message').textContent,/fechado ou ocultado/);
  const limited=await fixture({repairPage:{repair:{state:'limited',repaired:0,limited:true}}});limited.nodes.get('repair').click();await limited.flush();
  assert.match(limited.nodes.get('message').textContent,/atingiu um limite/);
});
test('partial visual repair is identified even when a notice has been hidden',async()=>{
  const f=await fixture({repairPage:{repair:{state:'partial',repaired:1,remaining:1}}});
  f.nodes.get('repair').click();await f.flush();assert.match(f.nodes.get('message').textContent,/conteúdo ainda apresenta um bloqueio/);
});
test('tools clean only the supplied link, require a copy action, and discard stale previews',async()=>{
  const f=await fixture();
  f.nodes.get('linkInput').value='https://example.test/read?id=17&utm_source=mail#chapter';
  f.nodes.get('cleanLink').click();await f.flush();
  assert.equal(f.nodes.get('linkOutput').value,'https://example.test/read?id=17#chapter');
  assert.equal(f.copied.length,0);
  f.nodes.get('copyLink').click();await f.flush();assert.deepEqual(f.copied,['https://example.test/read?id=17#chapter']);
  f.nodes.get('linkInput').events.input();assert.equal(f.nodes.get('linkPreview').hidden,true);assert.equal(f.nodes.get('copyLink').disabled,true);
});
test('copy rejection leaves an explicit selection for manual copy without extra permission',async()=>{
  const f=await fixture({clipboardError:true});f.nodes.get('linkInput').value='https://example.test/?utm_medium=share';
  f.nodes.get('cleanLink').click();await f.flush();f.nodes.get('copyLink').click();await f.flush();
  assert.equal(f.nodes.get('linkOutput').selected,true);assert.match(f.nodes.get('message').textContent,/Ctrl\+C/);
});
test('focus settings and theme do not send advertising configuration changes',async()=>{
  const f=await fixture();const focus=f.nodes.get('focusShorts');focus.checked=true;focus.events.change({target:focus});await f.flush();
  assert.equal(f.preferences().focusShorts,true);assert.equal(f.requests.some(x=>x.type==='SET_OPTION'),false);
  f.nodes.get('theme').click();await f.flush();assert.equal(f.preferences().theme,'dark');assert.equal(f.preferences().focusShorts,true);
  f.nodes.get('settings').click();await f.flush();assert.equal(f.opened(),1);
});
test('all four sections support End and wrap-around keyboard navigation',async()=>{
  const f=await fixture();f.nodes.get('tab-general').events.keydown({key:'End',preventDefault(){}});
  assert.equal(f.nodes.get('tab-tools').attributes['aria-selected'],'true');
  f.nodes.get('tab-tools').events.keydown({key:'ArrowRight',preventDefault(){}});
  assert.equal(f.nodes.get('tab-general').attributes['aria-selected'],'true');
});
test('a failed preferences write restores the persisted focus choice and reports the failure',async()=>{
  const f=await fixture({storageError:true}),focus=f.nodes.get('focusShorts');
  focus.checked=true;focus.events.change({target:focus});await f.flush();
  assert.equal(focus.checked,false);assert.equal(f.preferences().focusShorts,false);
  assert.match(f.nodes.get('message').textContent,/Storage fixture failure/);
});
test('Android returns to the page after saving repair when the action overlay suspends scanning',async()=>{
  const f=await fixture({platform:'android',repairPage:{repair:{state:'limited',limited:true,repaired:0}}});
  f.nodes.get('repair').click();await f.flush();
  assert.ok(f.requests.some(x=>x.type==='SET_REPAIR'&&x.enabled));
  assert.equal(f.closed(),1);assert.match(f.nodes.get('message').textContent,/Voltando à página/);
});
test('Android keeps an error or partial repair visible and never closes before saving',async()=>{
  for(const options of [{repairError:true},{repairPage:{repair:{state:'partial',repaired:1,remaining:1}}}]){
    const f=await fixture({platform:'android',...options});f.nodes.get('repair').click();await f.flush();assert.equal(f.closed(),0);
  }
});
test('Android manual copy uses touch instructions and a platform lookup failure leaves desktop usable',async()=>{
  const f=await fixture({platform:'android',clipboardError:true});f.nodes.get('linkInput').value='https://example.test/?utm_source=share';
  f.nodes.get('cleanLink').click();await f.flush();f.nodes.get('copyLink').click();await f.flush();assert.match(f.nodes.get('message').textContent,/Toque e segure/);
  const fallback=await fixture({platformError:true});assert.equal(fallback.nodes.get('hostname').textContent,'www.youtube.com');
});
