const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const P=require('../popup-policy.js');
const C=require('../common.js');
const source=fs.readFileSync(path.join(__dirname,'../popup-main.js'),'utf8');
function fixture({host='reader.example',frame=false}={}) {
  const listeners={},docListeners={},calls=[],dialogs=[],microtasks=[];
  const context=vm.createContext({NavegaPopupPolicy:P,location:{href:'https://'+host+'/',hostname:host},
    performance:{now:()=>1000},navigator:{userActivation:{isActive:true}},setTimeout:fn=>microtasks.push(fn),URL,
    innerWidth:1000,innerHeight:800,getComputedStyle:node=>node.style,
    open:(...args)=>(calls.push(args),{closed:false}),alert:text=>dialogs.push(text),confirm:text=>(dialogs.push(text),true),prompt:text=>(dialogs.push(text),'input'),
    addEventListener:(name,fn)=>listeners[name]=fn,
    document:{addEventListener:(name,fn)=>docListeners[name]=fn,dispatchEvent(){}},Event:class{constructor(type){this.type=type}}});
  vm.runInContext(frame?'globalThis.top={};':'globalThis.top=globalThis;',context);
  vm.runInContext(source,context);
  function click(kind,action,{href=null,trusted=true,type='click',overlay=false}={}) {
    let prevented=false;
    const anchor=kind==='link'?{getAttribute:()=>href,...(overlay?{textContent:'',querySelector:()=>null,
      getBoundingClientRect:()=>({width:1000,height:800}),style:{position:'fixed',zIndex:'999999',opacity:'0',backgroundColor:'rgba(0, 0, 0, 0)'}}:{})}:null;
    const node={nodeType:1,closest:selector=>selector.startsWith('a[')?anchor:(kind==='button'?{}:null)};
    const event={isTrusted:trusted,target:node,composedPath:()=>[node],preventDefault:()=>prevented=true,stopImmediatePropagation(){}};
    listeners[type](event);const result=action?.();
    while(microtasks.length)microtasks.shift()();
    return {result,prevented};
  }
  return {context,calls,dialogs,click,state:()=>context.__navegaLivrePopupState(),
    enabled:value=>docListeners['navega-livre-popup-config']({detail:JSON.stringify({enabled:value})})};
}
test('network classification covers observed ads across sites without URL-string lookalike matches',()=>{
  for(const host of ['demand.pubadx.one','platform.pubadx.one','ppo.diveinthebluesky.biz','pa.diffgremio.com','acscdn.com','ad.a-ads.com','ads.exoclick.com','popads.net'])assert.equal(P.adUrl('https://'+host+'/loader'),true,host);
  for(const value of ['https://pubadx.one.example/','https://example.test/?pubadx.one','https://lycantoons.com/series','https://discord.gg/invite','https://www.google.com/recaptcha','data:text/plain,pubadx.one'])assert.equal(P.adUrl(value),false,value);
});
test('automatic popups and page-wide click hijacks are blocked on different page domains',()=>{
  for(const host of ['reader.example','news.example','video.example']) {
    const f=fixture({host});
    assert.equal(f.context.open('https://unknown-ad.example/'),null);
    assert.equal(f.click('body',()=>f.context.open('https://unknown-ad.example/')).result,null);
    assert.equal(f.click('link',()=>f.context.open('https://unknown-ad.example/'),{href:'/chapter/1'}).result,null);
    assert.equal(f.calls.length,0);assert.equal(f.state().popupsBlocked,3);
  }
});
test('explicit normal links and authentication, sharing and print buttons keep working',()=>{
  const f=fixture();
  assert.ok(f.click('link',()=>f.context.open('https://discord.gg/invite','_blank'),{href:'https://discord.gg/invite'}).result);
  assert.ok(f.click('link',()=>f.context.open('/chapter/1','_blank'),{href:'/chapter/1'}).result);
  assert.ok(f.click('button',()=>f.context.open('https://accounts.google.com/oauth','login')).result);
  assert.ok(f.click('button',()=>f.context.open('about:blank','print')).result);
  assert.ok(f.context.open('/chapter/2','_self'));
  assert.equal(f.calls.length,5);assert.equal(f.state().popupsBlocked,0);
});
test('known ad popups, named popunders and advertising link clicks remain blocked during real gestures',()=>{
  const f=fixture();
  assert.equal(f.click('button',()=>f.context.open('https://demand.pubadx.one/click','hidden')).result,null);
  assert.equal(f.click('button',()=>f.context.open('https://popads.net/','_self')).result,null);
  assert.equal(f.click('link',null,{href:'https://ads.exoclick.com/click',type:'auxclick'}).prevented,true);
  assert.equal(f.state().linksBlocked,1);assert.equal(f.calls.length,0);
});
test('invisible external links covering the screen are stopped, while normal links and same-site controls remain usable',()=>{
  const f=fixture();
  assert.equal(f.click('link',null,{href:'https://unknown-ad.example/',overlay:true}).prevented,true);
  assert.equal(f.click('link',null,{href:'/chapter/1',overlay:true}).prevented,false);
  assert.equal(f.click('link',null,{href:'https://normal.example/'}).prevented,false);
  f.enabled(false);assert.equal(f.click('link',null,{href:'https://unknown-ad.example/',overlay:true}).prevented,false);
});
test('synthetic events and stale gestures do not grant script popup permission',()=>{
  const f=fixture();
  assert.equal(f.click('button',()=>f.context.open('https://normal.example/'),{trusted:false}).result,null);
  f.click('button');assert.equal(f.context.open('https://normal.example/'),null);
  assert.equal(f.click('button',()=>f.click('link',()=>f.context.open('https://normal.example/'),{trusted:false,href:'https://normal.example/'}).result).result,null);
  assert.equal(f.calls.length,0);
});
test('only install-bait dialogs are suppressed; normal confirmations, prompts and alerts are preserved',()=>{
  const f=fixture();
  assert.equal(f.context.confirm('Instale Ad Blocker Premium para desbloquear o conteúdo.'),false);
  assert.equal(f.context.prompt('Download an ad blocker, required to continue'),null);
  f.context.alert('Instale bloqueador de anúncios necessário para continuar');
  assert.equal(f.state().dialogsBlocked,3);assert.equal(f.dialogs.length,0);
  assert.equal(f.context.confirm('Excluir seu comentário?'),true);
  assert.equal(f.context.prompt('Digite seu nome:'),'input');
  f.context.alert('Senha incorreta.');assert.equal(f.dialogs.length,3);
});
test('site/global pause reverses popup and dialog handling without changing native results',()=>{
  const f=fixture();f.enabled(false);
  assert.ok(f.context.open('https://popads.net/'));assert.equal(f.context.confirm('Instale Ad Blocker Premium para desbloquear'),true);
  assert.equal(f.state().enabled,false);assert.equal(f.state().popupsBlocked,0);
  f.enabled(true);assert.equal(f.context.open('https://popads.net/'),null);
});
test('frames defer until parent preferences arrive and advertising frames cannot spawn windows when active',()=>{
  const f=fixture({host:'ad.a-ads.com',frame:true});
  assert.ok(f.context.open('https://normal.example/'));f.enabled(true);
  assert.equal(f.click('button',()=>f.context.open('https://normal.example/')).result,null);
  f.enabled(false);assert.ok(f.context.open('https://normal.example/'));
});
test('Firefox preference bridge honors a paused parent frame and emits JSON text without host lists',async()=>{
  const events=[];let changed,readyHandler;
  const api={storage:{local:{get:async()=>({config:C.normalizeConfig({disabledHosts:['parent.example']})})},onChanged:{addListener:fn=>changed=fn}},runtime:{sendMessage:async()=>({ok:true,host:'parent.example'})}};
  const context=vm.createContext({NavegaCore:C,browser:api,chrome:{},top:{},location:{hostname:'frame.example'},
    document:{addEventListener:(type,fn)=>readyHandler=fn,dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../popup-bridge.js'),'utf8'),context);
  await new Promise(r=>setImmediate(r));assert.equal(JSON.parse(events.at(-1).detail).enabled,false);
  changed({config:{newValue:C.normalizeConfig()}},'local');assert.equal(JSON.parse(events.at(-1).detail).enabled,true);
  readyHandler();assert.equal(typeof events.at(-1).detail,'string');assert.deepEqual(Object.keys(JSON.parse(events.at(-1).detail)),['enabled']);
});
test('the MAIN guard modifies the actual page Window when the execution global is a separate Firefox-style object',()=>{
  const page={open:function(){assert.equal(this,page);return 'native';}},listeners={};page.top=page;
  const context=vm.createContext({window:page,top:page,NavegaPopupPolicy:P,
    location:{href:'https://reader.example/'},performance:{now:()=>0},navigator:{userActivation:{isActive:true}},
    addEventListener(){},setTimeout(){},document:{addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent(){}},Event:class{}});
  vm.runInContext(source,context);
  assert.equal(page.__navegaLivrePopupState().enabled,true);
  assert.equal(page.open('https://unknown.example/'),null);
  listeners['navega-livre-popup-config']({detail:'{"enabled":false}'});
  assert.equal(page.open('https://popads.net/'),'native');
});
