const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../common.js');
const root=path.resolve(__dirname,'..');
async function fixture(options={}){
  const nodes=new Map(),requests=[],sent=[];let lastBlob,config=C.normalizeConfig(),network={available:true,enabledRulesets:['advertising','privacy'],error:null};
  class Node{
    constructor(){this.events={};this.attributes={};this.checked=false;this.disabled=false;this.hidden=false;this.classList={toggle(){},remove(){}};}
    setAttribute(key,value){this.attributes[key]=value;}
    addEventListener(type,fn){this.events[type]=fn;}
    focus(){this.focused=true;}
    appendChild(){} remove(){} click(){this.events.click?.({target:this});}
  }
  for(const match of fs.readFileSync(path.join(root,'popup.html'),'utf8').matchAll(/id="([^"]+)"/g))nodes.set(match[1],new Node());
  const document={getElementById:id=>nodes.get(id),createElement:()=>new Node(),body:new Node(),hidden:false};
  class LocalURL extends URL{static createObjectURL(blob){lastBlob=blob;return'blob:fixture';}static revokeObjectURL(){}}
  const api={runtime:{getManifest:()=>({version:'0.3.0',browser_specific_settings:{gecko:{id:'fixture'}}}),sendMessage:async message=>{
    requests.push(message);
    if(message.type==='GET_CONFIG')return{ok:true,config,network};
    if(message.type==='SET_OPTION'){config=C.normalizeConfig({...config,[message.key]:message.value});return{ok:true,config};}
    if(message.type==='GET_YOUTUBE_DIAGNOSTIC')return{ok:true,registration:{active:true,error:null},main:{installed:true,enabled:true,fetchMatched:1,xhrMatched:2,adFieldsRemoved:3}};
    return{ok:false,error:'Unexpected fixture message'};
  }},tabs:{query:async()=>[{id:7,url:options.url||'https://www.youtube.com/watch?token=private#private'}],sendMessage:async(...args)=>{sent.push(args);return{adsHidden:2,skipClicks:1};},reload:async()=>{}}};
  const context=vm.createContext({NavegaCore:C,browser:api,chrome:{},document,URL:LocalURL,Blob,window:{close(){}},setInterval(){},setTimeout(){},console});
  vm.runInContext(fs.readFileSync(path.join(root,'popup.js'),'utf8'),context);
  const flush=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));};
  await flush();
  return{nodes,requests,sent,flush,blob:()=>lastBlob,networkError:error=>network={...network,error}};
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
