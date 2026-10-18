const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../common.js'),P=require('../popup-policy.js');
async function fixture(host,html,config={}){
  const {parseHTML}=await import('./vendor/linkedom.mjs');const {window,document}=parseHTML(html);
  const E=window.Element.prototype;let changed,message,interval,observer,clock=10000;const tasks=[];
  E.getBoundingClientRect=function(){return {width:parseInt(this.style.width)||440,height:parseInt(this.style.height)||230};};
  E.getClientRects=function(){for(let n=this;n;n=n.parentElement)if(n.style.display==='none'||n.hasAttribute('data-navega-livre-hidden'))return [];return [{}];};
  const styleProto=Object.getPrototypeOf(document.body.style);if(!styleProto.getPropertyPriority)styleProto.getPropertyPriority=()=>'';
  const styles=node=>({position:node.style.position||'static',display:node.getClientRects().length?'block':'none',visibility:'visible',opacity:'1'});
  const api={storage:{local:{get:async()=>({config:C.normalizeConfig(config)})},onChanged:{addListener:fn=>changed=fn}},runtime:{sendMessage:async()=>({ok:true}),onMessage:{addListener:fn=>message=fn}}};
  const context=vm.createContext({document,URL,location:{hostname:host,href:'https://'+host+'/'},getComputedStyle:styles,
    NavegaCore:C,NavegaPopupPolicy:P,NavegaCosmeticData:{exceptions:[]},chrome:api,Date:{now:()=>clock},performance,console,
    MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},CustomEvent:window.CustomEvent,
    setTimeout:fn=>(tasks.push(fn),tasks.length),clearTimeout(){},setInterval:fn=>(interval=fn,1),clearInterval:()=>interval=null,addEventListener(){}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../notice-policy.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../content.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return {document,window,N:context.NavegaNoticePolicy,change:async patch=>{changed({config:{newValue:C.normalizeConfig(patch)}},'local');await new Promise(resolve=>setImmediate(resolve));},
    rescan:()=>{clock+=2000;observer([]);tasks.splice(0).forEach(fn=>fn());},tick:()=>interval?.(),status:()=>{let value;message({type:'PAGE_STATUS'},{},r=>value=r);return value;}};
}
function page(title,text,close=true){return `<html><body style="overflow:hidden"><main id="reader">Conteúdo e capítulos normais</main><div id="notice" style="position:fixed;width:440px"><h2>${title}</h2><p>${text}</p>${close?'<button id="dismiss" aria-label="Fechar">×</button>':''}<button id="vip">Conhecer o VIP</button></div><div id="login" role="dialog">Faça login para conteúdo VIP<input type="password"></div></body></html>`;}
test('anonymous Lycan and Vegitoons notice containers are repaired only after opt-in',async()=>{
  for(const [host,title] of [['lycantoons.com','Precisamos da sua ajuda'],['vegitoons.black','Detectamos um bloqueador de anúncios']]){
    const f=await fixture(host,page(title,'Desative o bloqueador aqui ou conheça o VIP.'));
    let closed=0,paid=0;f.document.querySelector('#dismiss').addEventListener('click',()=>closed++);f.document.querySelector('#vip').addEventListener('click',()=>paid++);
    assert.equal(f.document.querySelector('#notice').hasAttribute('data-navega-livre-hidden'),false);
    await f.change({repairHosts:[host]});
    assert.equal(f.document.querySelector('#notice').getAttribute('data-navega-livre-hidden'),'notice');
    assert.equal(closed,1);assert.equal(paid,0);assert.equal(f.document.querySelector('#login').hasAttribute('data-navega-livre-hidden'),false);
    assert.equal(f.document.querySelector('#reader').hasAttribute('data-navega-livre-hidden'),false);
    assert.equal(f.document.body.style.overflow,'auto');
  }
});
test('mixed notices on unknown sites and known notices without a native dismiss control stay untouched',async()=>{
  for(const [host,close] of [['unknown.example',true],['lycantoons.com',false]]){
    const f=await fixture(host,page('Precisamos da sua ajuda','Desative o bloqueador ou assine o VIP.',close),{repairHosts:[host]});
    assert.equal(f.document.querySelector('#notice').hasAttribute('data-navega-livre-hidden'),false);
  }
});
test('a labeled download advertisement is hidden while an ordinary download dialog is preserved',async()=>{
  const html='<html><body><main id="reader">Leitura</main><div id="advert" style="position:fixed"><span>Ad</span><strong>1 passo restante</strong><p>Termine o seu Descarregamento agora</p><button>Continuar</button></div><div id="download" role="dialog" style="position:fixed"><p>Termine seu download</p><button>Continuar</button></div></body></html>';
  const f=await fixture('reader.example',html);
  assert.equal(f.document.querySelector('#advert').getAttribute('data-navega-livre-hidden'),'ad');
  assert.equal(f.document.querySelector('#download').hasAttribute('data-navega-livre-hidden'),false);
  assert.equal(f.document.querySelector('#reader').hasAttribute('data-navega-livre-hidden'),false);
  await f.change({cosmetics:false});assert.equal(f.document.querySelector('#advert').hasAttribute('data-navega-livre-hidden'),false);
});
test('password dialogs and document roots are protected even when they mention adblock',async()=>{
  const html='<html><body><main id="reader" style="position:fixed">Desative seu adblock</main><div id="auth" role="dialog" style="position:fixed">Desative seu adblock<input type="password"></div></body></html>';
  const f=await fixture('reader.example',html,{repairHosts:['reader.example']});
  assert.equal(f.N.canRepair(f.document.querySelector('#auth'),'reader.example'),false);
  assert.equal(f.N.canRepair(f.document.querySelector('#reader'),'reader.example'),false);
  assert.equal(f.document.querySelector('#auth').hasAttribute('data-navega-livre-hidden'),false);
});
test('open shadow-root advertising is scanned, observed and restored on pause',async()=>{
  const f=await fixture('reader.example','<html><body><main>Conteúdo</main><div id="host"></div></body></html>');
  const shadow=f.document.querySelector('#host').attachShadow({mode:'open'});const ad=f.document.createElement('div');ad.className='ad-banner';ad.style.setProperty('display','flex');shadow.appendChild(ad);f.rescan();
  assert.equal(ad.getAttribute('data-navega-livre-hidden'),'ad');assert.equal(ad.style.display,'none');
  await f.change({enabled:false});assert.equal(ad.hasAttribute('data-navega-livre-hidden'),false);assert.equal(ad.style.display,'flex');
});
test('cosmetic stylesheet activation follows global, per-site and cosmetics preferences',async()=>{
  const f=await fixture('reader.example','<html><body><main>Conteúdo</main></body></html>');
  assert.equal(f.document.documentElement.getAttribute('data-navega-livre-cosmetics'),'on');
  await f.change({disabledHosts:['reader.example']});assert.equal(f.document.documentElement.getAttribute('data-navega-livre-cosmetics'),'off');
  await f.change({cosmetics:false});assert.equal(f.document.documentElement.getAttribute('data-navega-livre-cosmetics'),'off');
});
