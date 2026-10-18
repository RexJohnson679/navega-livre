const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../notice-repair.js'),'utf8');
async function fixture(html='<main>Leitura normal</main>',options={}) {
  const {parseHTML}=await import('./vendor/linkedom.mjs');
  const {window,document}=parseHTML('<html><body>'+html+'</body></html>');
  Object.defineProperty(document,'hidden',{value:false,writable:true,configurable:true});
  const E=window.Element.prototype;
  E.getClientRects=function(){
    for(let n=this;n;n=n.parentElement || n.getRootNode?.().host)if(n.style?.display==='none'||n.hasAttribute?.('hidden'))return [];
    return [{}];
  };
  E.getBoundingClientRect=function(){return {width:parseInt(this.style.width)||440,height:parseInt(this.style.height)||240};};
  const proto=Object.getPrototypeOf(document.body.style);
  if (!proto.__navegaPriority) {
    const priority=new WeakMap(), set=proto.setProperty, remove=proto.removeProperty;
    Object.defineProperty(proto,'__navegaPriority',{value:true});
    proto.setProperty=function(key,value,level=''){if(!priority.has(this))priority.set(this,{});priority.get(this)[key]=level;return set.call(this,key,value);};
    proto.getPropertyPriority=function(key){return priority.get(this)?.[key]||'';};
    proto.removeProperty=function(key){if(priority.has(this))delete priority.get(this)[key];return remove.call(this,key);};
  }
  const timers=new Map(),observers=[];let serial=0,calls=0,clock=0;
  function getStyle(node){calls++;return {position:node.style.position||'static',display:node.getClientRects().length?'block':'none',
    visibility:node.style.visibility||'visible',zIndex:node.style.zIndex||'auto',overflow:node.style.overflow||'visible',overflowY:node.style.overflowY||'visible',
    filter:node.style.filter||'none',pointerEvents:node.style.getPropertyValue('pointer-events')||'auto'};}
  document.elementsFromPoint=()=>options.foreground?[document.querySelector(options.foreground)].filter(Boolean):[];
  const context=vm.createContext({document,performance,console,getComputedStyle:getStyle,
    setTimeout:(fn,delay=0)=>{const id=++serial;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id),
    MutationObserver:class{constructor(fn){this.fn=fn;this.targets=new Set();observers.push(this);}observe(node){this.targets.add(node);}disconnect(){this.targets.clear();}}});
  vm.runInContext(source,context);
  const R=context.NavegaNoticeRepair;let repairs=0;
  let engine=R.create({document,onRepair:()=>repairs++});
  async function drain(limit=500) {
    let count=0;
    while(timers.size){if(++count>limit)throw Error('Timer loop');const [id,item]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(id);clock=item.at;item.fn();await Promise.resolve();}
  }
  const notify=records=>observers.forEach(o=>{if(o.targets.size)o.fn(records);});
  async function loadContent(config={},extra={}) {
    const C=require('../common.js'),P=require('../popup-policy.js');
    let settings=C.normalizeConfig(config),changed,message;const intervals=new Map();let iid=0;
    const api={storage:{local:{get:async()=>({config:settings})},onChanged:{addListener:fn=>changed=fn}},runtime:{
      sendMessage:async()=>({ok:true,host:extra.topHost||'new-site.example'}),onMessage:{addListener:fn=>message=fn}}};
    const create=R.create;R.create=opts=>(engine=create(opts));
    Object.assign(context,{NavegaCore:C,NavegaPopupPolicy:P,NavegaCosmeticData:{exceptions:[]},chrome:api,URL,Date:{now:()=>10000+clock},
      location:{hostname:'new-site.example',href:'https://new-site.example/'},
      addEventListener(){},CustomEvent:window.CustomEvent,
      setInterval:fn=>{intervals.set(++iid,fn);return iid;},clearInterval:id=>intervals.delete(id)});
    if(extra.topHost)context.top={};
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../notice-policy.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../content.js'),'utf8'),context);
    await new Promise(resolve=>setImmediate(resolve));await drain();
    return {send:data=>new Promise(resolve=>message(data,{},resolve)),intervals:()=>intervals.size,
      change:async patch=>{settings=C.normalizeConfig({...settings,...patch});changed({config:{newValue:settings}},'local');await drain();}};
  }
  return {R,get engine(){return engine;},document,window,drain,notify,loadContent,repairs:()=>repairs,timers:()=>timers.size,calls:()=>calls,
    run:async()=>{const promise=engine.run();await drain();return promise;},
    mutate:async(node,type='childList',addedNodes=[])=>{notify([{target:node,type,addedNodes,attributeName:'style'}]);await drain();}};
}
const hidden=node=>node.getAttribute('data-navega-livre-hidden')==='notice';
test('unknown anonymous fixed notices are detected from split text without a domain adapter',async()=>{
  const f=await fixture('<main id="reader">Capítulo normal</main><div id="anonymous" style="position:fixed"><h2>Desative seu <b>bloqueador</b> de anúncios</h2><p>para continuar</p></div>');
  assert.equal(f.timers(),0);assert.equal(hidden(f.document.querySelector('#anonymous')),false);
  const result=await f.run();
  assert.equal(result.state,'repaired');assert.equal(result.repaired,1);
  assert.equal(hidden(f.document.querySelector('#anonymous')),true);
  assert.equal(hidden(f.document.querySelector('#reader')),false);
  assert.equal(f.engine.diagnostics().timer,false);
});
test('English notices, inline blocker panels and explicit close controls work on new sites',async()=>{
  const f=await fixture('<main>Content</main><div role="dialog" id="notice"><p>Please turn off your ad blocker to continue.</p><button id="close" aria-label="Close">×</button></div><aside id="adblock-panel">Adblock detected. Please disable it.</aside>');
  let clicks=0;f.document.querySelector('#close').addEventListener('click',()=>clicks++);
  const result=await f.run();assert.equal(result.repaired,2);assert.equal(clicks,1);
  assert.equal(hidden(f.document.querySelector('#adblock-panel')),true);
  await f.run();assert.equal(clicks,1,'do not repeatedly activate a close handler');
});
test('login, paywalls, code examples, normal articles and application roots remain intact',async()=>{
  const f=await fixture('<main><p>Desative seu bloqueador de anúncios neste tutorial.</p></main><article><div id="adblock-example">Disable adblock</div></article><div role="dialog" id="login">Disable your adblock and sign in<input type="password"></div><div role="dialog" id="paid">Disable adblock or subscribe to premium</div><pre style="position:fixed">Disable adblock</pre><div id="root" style="position:fixed">Disable adblock</div><div role="dialog" id="unrelated">O site usa anúncios para manter o serviço.</div>');
  const result=await f.run();assert.equal(result.repaired,0);
  assert.equal(f.document.querySelectorAll('[data-navega-livre-hidden]').length,0);
});
test('a mixed donation notice uses only its close button; subscription and anchor buttons are ignored',async()=>{
  const f=await fixture('<div role="dialog" id="donation">Detectamos um bloqueador de anúncios. Desative ou conheça o VIP.<button id="close">Fechar</button><button id="paid">Conhecer VIP</button></div><div role="dialog" id="linked">Disable adblock or subscribe<a href="/pay"><button>Close</button></a></div>');
  let closed=0,paid=0;f.document.querySelector('#close').addEventListener('click',()=>closed++);f.document.querySelector('#paid').addEventListener('click',()=>paid++);
  await f.run();assert.equal(closed,1);assert.equal(paid,0);assert.equal(hidden(f.document.querySelector('#linked')),false);
});
test('related empty backdrops, scroll and inert state are repaired and restored on stop',async()=>{
  const f=await fixture('<main id="reader" inert="">Conteúdo</main><div id="scrim" class="modal-backdrop" style="position:fixed;width:3000px;height:2000px"></div><div id="notice" role="dialog">Disable your adblock</div>');
  f.document.body.style.setProperty('overflow','hidden','important');
  f.document.querySelector('#notice').style.setProperty('display','flex');
  await f.run();assert.equal(hidden(f.document.querySelector('#scrim')),true);assert.equal(f.document.body.style.overflow,'auto');
  assert.equal(f.document.querySelector('#reader').hasAttribute('inert'),false);
  f.engine.stop();assert.equal(f.document.body.style.overflow,'hidden');assert.equal(f.document.body.style.getPropertyPriority('overflow'),'important');
  assert.equal(f.document.querySelector('#reader').hasAttribute('inert'),true);assert.equal(hidden(f.document.querySelector('#scrim')),false);
  assert.equal(f.document.querySelector('#notice').style.display,'flex');
  assert.equal(f.engine.diagnostics().retained,0);assert.equal(f.engine.diagnostics().locks,0);
});
test('another active login modal keeps the page scroll lock and backdrop untouched',async()=>{
  const f=await fixture('<main inert>Content</main><div id="backdrop" class="modal-backdrop" style="position:fixed;width:3000px;height:2000px"></div><div role="dialog" id="notice">Disable adblock</div><div role="dialog" id="login">Faça login<input type="password"></div>');
  f.document.body.style.setProperty('overflow','hidden');await f.run();
  assert.equal(hidden(f.document.querySelector('#notice')),true);assert.equal(f.document.body.style.overflow,'hidden');
  assert.equal(f.document.querySelector('main').hasAttribute('inert'),true);
  assert.equal(hidden(f.document.querySelector('#backdrop')),false);
});
test('dynamically inserted notices and edited text are detected without any polling interval',async()=>{
  const f=await fixture();f.engine.start();await f.drain();assert.equal(f.timers(),0);
  const notice=f.document.createElement('div');notice.id='new';notice.style.position='fixed';notice.innerHTML='<p>Adblock detected</p>';
  f.document.body.appendChild(notice);await f.mutate(f.document.body,'childList',[notice]);assert.equal(hidden(notice),true);
  const other=f.document.createElement('div');other.style.position='fixed';other.textContent='Preparando';f.document.body.appendChild(other);
  await f.mutate(f.document.body,'childList',[other]);assert.equal(hidden(other),false);
  other.textContent='Desative o bloqueador de anúncios';await f.mutate(other.firstChild,'characterData');assert.equal(hidden(other),true);
  assert.equal(f.timers(),0);
});
test('own style writes do not trigger another scan; new close controls are not clicked twice',async()=>{
  const f=await fixture('<div role="dialog" id="notice">Disable adblock<button>Close</button></div>');
  await f.run();const before=f.engine.diagnostics().runs;
  const node=f.document.querySelector('#notice');await f.mutate(node,'attributes');
  assert.equal(f.engine.diagnostics().runs,before);assert.equal(f.timers(),0);
});
test('manual scans give per-attempt results and recognize a late foreground notice on a large page',async()=>{
  const f=await fixture('<main>'+('<p>Normal reading text</p>'.repeat(13000))+'</main><div id="late" style="position:fixed">Disable adblock</div>',{foreground:'#late'});
  const first=await f.run();assert.equal(first.repaired,1);assert.equal(hidden(f.document.querySelector('#late')),true);
  const again=await f.run();assert.equal(again.repaired,0);assert.equal(again.limited,true);
  const d=f.engine.diagnostics();assert.ok(d.maxSliceNodes<=d.limits.sliceNodes);assert.equal(f.timers(),0);
});
test('pending work and retained node references stay bounded during mutation storms',async()=>{
  const f=await fixture();f.engine.start();await f.drain();
  const nodes=Array.from({length:180},()=>{const n=f.document.createElement('section');n.textContent='normal';f.document.body.appendChild(n);return n;});
  f.notify(nodes.map(node=>({target:node,type:'attributes',attributeName:'class',addedNodes:[]})));
  assert.ok(f.engine.diagnostics().queued<=f.R.LIMITS.scopes+1);await f.drain();
  f.document.body.innerHTML=Array.from({length:90},(_,i)=>'<div role="dialog" id="n'+i+'">Disable adblock</div>').join('');
  await f.run();assert.ok(f.engine.diagnostics().retained<=f.R.LIMITS.retained);f.engine.stop();
  assert.equal(f.engine.diagnostics().retained,0);assert.equal(f.engine.diagnostics().queued,0);assert.equal(f.timers(),0);
});
test('background tabs stop work, resume on visibility and discard detached nodes',async()=>{
  const f=await fixture('<div role="dialog" id="notice">Disable adblock</div>');
  f.document.hidden=true;const result=await f.run();assert.equal(result.limited,true);assert.equal(f.timers(),0);
  f.document.hidden=false;f.document.dispatchEvent(new f.window.Event('visibilitychange'));await f.drain();
  const node=f.document.querySelector('#notice');assert.equal(hidden(node),true);node.remove();
  await f.mutate(f.document.body);assert.equal(f.engine.diagnostics().retained,0);
  f.engine.stop();
});
test('open shadow roots are analyzed and exact inline display is restored',async()=>{
  const f=await fixture('<main>Reader</main><div id="host"></div>');
  const shadow=f.document.querySelector('#host').attachShadow({mode:'open'});shadow.innerHTML='<div id="notice" style="position:fixed;display:flex">Disable adblock</div>';
  await f.run();const node=shadow.querySelector('#notice');assert.equal(hidden(node),true);
  assert.ok(f.engine.diagnostics().shadowRoots>0);f.engine.stop();assert.equal(node.style.display,'flex');assert.equal(f.engine.diagnostics().shadowRoots,0);
});
test('native dialogs leave the top layer through close() and do not simulate arbitrary keyboard input',async()=>{
  const f=await fixture('<dialog id="notice" open>Desative seu bloqueador de anúncios.</dialog>');
  const node=f.document.querySelector('#notice');let closed=0;node.close=()=>{closed++;node.removeAttribute('open');};
  await f.run();assert.equal(closed,1);assert.equal(node.hasAttribute('open'),false);
});
test('a notice re-rendered using the same node is hidden again without retaining more nodes',async()=>{
  const f=await fixture('<div id="notice" style="position:fixed">Disable adblock</div>');
  await f.run();const node=f.document.querySelector('#notice');
  node.removeAttribute('data-navega-livre-hidden');node.style.setProperty('display','block','important');
  await f.mutate(node,'attributes');assert.equal(hidden(node),true);assert.equal(node.style.display,'none');
  assert.equal(f.engine.diagnostics().retained,1);
});
test('a named message inside an anonymous overlay repairs the outer overlay without hiding the reader',async()=>{
  const f=await fixture('<main id="reader">Chapter</main><div id="outside" style="position:fixed"><section class="adblock-message">Disable adblock</section></div>');
  await f.run();assert.equal(hidden(f.document.querySelector('#outside')),true);assert.equal(hidden(f.document.querySelector('#reader')),false);
});
test('production content wiring waits for opt-in, returns asynchronous button results and undoes on pause',async()=>{
  const f=await fixture('<main id="reader">Reader</main><div role="dialog" id="notice">Disable adblock</div>');
  const content=await f.loadContent({cosmetics:false});
  assert.equal(hidden(f.document.querySelector('#notice')),false);assert.equal(f.engine.diagnostics().enabled,false);
  const reply=content.send({type:'REPAIR_NOW',enabled:true});await f.drain();const result=await reply;
  assert.equal(result.repair.repaired,1);assert.equal(result.noticesHidden,1);assert.equal(content.intervals(),0);
  const status=await content.send({type:'PAGE_STATUS'});assert.equal(status.repair.state,'repaired');
  await content.change({repairHosts:['new-site.example'],disabledHosts:['new-site.example']});
  assert.equal(hidden(f.document.querySelector('#notice')),false);assert.equal(f.engine.diagnostics().enabled,false);
});
test('remembered repair preference is inherited inside frames and respects the parent pause',async()=>{
  const f=await fixture('<main>Frame content</main><div style="position:fixed" id="notice">Desative seu bloqueador de anúncios.</div>');
  const content=await f.loadContent({cosmetics:false,repairHosts:['parent.example']},{topHost:'parent.example'});
  assert.equal(hidden(f.document.querySelector('#notice')),true);assert.equal(content.intervals(),0);
  await content.change({disabledHosts:['parent.example']});
  assert.equal(hidden(f.document.querySelector('#notice')),false);assert.equal(f.engine.diagnostics().enabled,false);
});
test('a dialog body inside a semantic card removes the complete layer and restores nested background locks',async()=>{
  const f=await fixture('<div id="root"><div id="background" aria-hidden="true" inert="" style="filter:blur(7px);pointer-events:none"><section><main id="reader">Conteúdo normal disponível</main></section></div><div id="layer" style="position:fixed;z-index:99;width:1000px;height:800px"><article id="card"><header>Marca do site</header><section role="dialog" id="body"><h1>Desative o bloqueador de anúncios</h1><p>Os anúncios ajudam a manter o site.</p><button>Já desativei — verificar novamente</button></section><footer><a href="/privacy">Privacidade</a></footer></article></div></div>');
  const result=await f.run();
  assert.equal(hidden(f.document.querySelector('#layer')),true,'remove the shell, not only its message');
  assert.equal(f.document.querySelector('#background').hasAttribute('inert'),false);
  assert.equal(f.document.querySelector('#background').hasAttribute('aria-hidden'),false);
  assert.equal(f.document.querySelector('#background').style.filter,'none');
  assert.equal(f.document.querySelector('#background').style.getPropertyValue('pointer-events'),'auto');
  assert.equal(hidden(f.document.querySelector('#reader')),false);
  f.engine.stop();assert.equal(hidden(f.document.querySelector('#layer')),false);
  assert.equal(f.document.querySelector('#background').style.filter,'blur(7px)');
  assert.equal(f.document.querySelector('#background').hasAttribute('inert'),true);
  assert.equal(f.document.querySelector('#background').getAttribute('aria-hidden'),'true');
});
test('foreground cards with generated class names preserve article content outside their layer',async()=>{
  const f=await fixture('<main id="reader"><article>Notícias normais</article></main><div class="x934" id="layer" style="position:fixed;z-index:500"><article><header>Site</header><div role="dialog"><h2>Please disable your ad blocker</h2></div><footer>Contact</footer></article></div>');
  await f.run();assert.equal(hidden(f.document.querySelector('#layer')),true);assert.equal(hidden(f.document.querySelector('#reader')),false);
});
test('background recovery preserves unrelated filters and restores exact pointer and ARIA values',async()=>{
  const f=await fixture('<div id="background" aria-hidden="true" style="filter:brightness(0.7) blur(6px);pointer-events:none"><main>Conteúdo</main></div><div role="dialog">Disable your adblock</div>');
  const background=f.document.querySelector('#background');await f.run();
  assert.equal(background.style.filter,'brightness(0.7)');assert.equal(background.style.getPropertyValue('pointer-events'),'auto');
  assert.equal(background.hasAttribute('aria-hidden'),false);assert.ok(f.engine.status().unlocked>0);
  f.engine.stop();assert.equal(background.style.filter,'brightness(0.7) blur(6px)');
  assert.equal(background.style.getPropertyValue('pointer-events'),'none');assert.equal(background.getAttribute('aria-hidden'),'true');
});
test('still-hidden primary content produces a partial result instead of reporting a complete repair',async()=>{
  const f=await fixture('<main aria-hidden="true" style="display:none">Conteúdo retido pelo site</main><div role="dialog">Disable adblock</div>');
  const result=await f.run();assert.equal(result.repaired,1);assert.equal(result.state,'partial');assert.ok(result.remaining>0);
});
test('semantic recovery preserves fixed articles with instructions, reading shells and app roots',async()=>{
  const f=await fixture('<article id="guide" style="position:fixed"><h1>Guia de extensões</h1><p>Desative seu bloqueador de anúncios para este exemplo.</p></article><div id="root" style="position:fixed"><main id="reader"><h1>Texto normal</h1></main><div role="dialog" id="notice"><h2>Disable adblock</h2></div></div>');
  await f.run();assert.equal(hidden(f.document.querySelector('#guide')),false);
  assert.equal(hidden(f.document.querySelector('#reader')),false);assert.equal(hidden(f.document.querySelector('#root')),false);
  assert.equal(hidden(f.document.querySelector('#notice')),true);
});
test('native adblock dialogs with a small navigation footer are closed completely',async()=>{
  const f=await fixture('<div id="background" inert aria-hidden="true"><main>Conteúdo normal</main></div><dialog id="gate" open><div>Marca genérica</div><div class="adblock-message"><h1>Desative o bloqueador de anúncios</h1><p>Para continuar.</p><button id="retry">Verificar novamente</button><details><summary>Ajuda</summary>Instruções de publicidade</details></div><nav><a href="/privacy">Privacidade</a><a href="/contact">Contato</a></nav></dialog>');
  const gate=f.document.querySelector('#gate');let closed=0,retry=0;
  gate.close=()=>{closed++;gate.removeAttribute('open');};f.document.querySelector('#retry').addEventListener('click',()=>retry++);
  f.document.body.style.setProperty('overflow','hidden');const result=await f.run();
  assert.equal(hidden(gate),true);assert.equal(closed,1,'close the native modal and its browser backdrop');
  assert.equal(gate.hasAttribute('open'),false);assert.equal(retry,0);
  assert.equal(f.document.querySelector('#background').hasAttribute('inert'),false);assert.equal(f.document.body.style.overflow,'auto');
  assert.equal(result.state,'repaired');
});
test('an old partially hidden message does not prevent recovery of its still-open dialog',async()=>{
  const f=await fixture('<main inert>Reader</main><dialog id="gate" open><div>Brand</div><div class="adblock-message" data-navega-livre-hidden="notice" style="display:none"><h2>Disable your ad blocker</h2></div><nav><a href="/help">Help</a></nav></dialog>');
  const gate=f.document.querySelector('#gate');let closed=0;gate.close=()=>{closed++;gate.removeAttribute('open');};
  await f.run();assert.equal(closed,1);assert.equal(hidden(gate),true);assert.equal(f.document.querySelector('main').hasAttribute('inert'),false);
});
test('an already hidden native notice reopened by page code is closed without a polling loop',async()=>{
  const f=await fixture('<main>Content</main><dialog id="gate" open><h2>Disable adblock</h2><nav><a href="/privacy">Privacy</a></nav></dialog>');
  const gate=f.document.querySelector('#gate');let closed=0;gate.close=()=>{closed++;gate.removeAttribute('open');};
  await f.run();assert.equal(closed,1);
  gate.setAttribute('open','');f.document.body.style.setProperty('overflow','hidden');
  f.notify([{type:'attributes',attributeName:'open',target:gate,addedNodes:[]}]);await f.drain();
  assert.equal(closed,2);assert.equal(gate.hasAttribute('open'),false);assert.equal(f.document.body.style.overflow,'auto');assert.equal(f.timers(),0);
});
test('a navigation footer does not weaken protection of login forms or complex page navigation',async()=>{
  const f=await fixture('<main id="reader">Leitura</main><dialog id="login" open><h2>Disable adblock and sign in</h2><form><input type="password"></form><nav><a href="/privacy">Privacy</a></nav></dialog><dialog id="complex" open><h2>Disable adblock</h2><nav><button>Gerenciar conta</button></nav></dialog>');
  let closed=0;for(const n of f.document.querySelectorAll('dialog'))n.close=()=>closed++;
  await f.run();assert.equal(closed,0);assert.equal(hidden(f.document.querySelector('#login')),false);
  assert.equal(hidden(f.document.querySelector('#complex')),false);assert.equal(hidden(f.document.querySelector('#reader')),false);
});
test('a native notice inside a floating shell is closed as well as hiding the shell',async()=>{
  const f=await fixture('<main>Reading</main><div id="shell" style="position:fixed;z-index:99"><dialog id="gate" open><h2>Disable your adblock</h2><nav><a href="/info">Information</a></nav></dialog></div>');
  const gate=f.document.querySelector('#gate');let closed=0;gate.close=()=>{closed++;gate.removeAttribute('open');};
  await f.run();assert.equal(closed,1);assert.equal(gate.hasAttribute('open'),false);
});
