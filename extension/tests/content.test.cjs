const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../common.js');
const source = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');
class Style {
  constructor(){this.values={};this.priorities={};}
  getPropertyValue(k){return this.values[k] || '';}
  getPropertyPriority(k){return this.priorities[k] || '';}
  setProperty(k,v,p=''){this.values[k]=v;this.priorities[k]=p;}
  removeProperty(k){delete this.values[k];delete this.priorities[k];}
}
class Node {
  constructor({id='', text='', matches=[], position='static'}={}){
    this.id=id;this.textContent=text;this.attributes={};this.style=new Style();
    this.isConnected=true;this.position=position;this.matchers=matches;
    this.selectors={};this.disabled=false;this.muted=false;this.visible=true;
    this.classes=new Set();this.classList={contains:k=>this.classes.has(k)};
  }
  hasAttribute(k){return Object.hasOwn(this.attributes,k);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k] ?? null;}
  removeAttribute(k){delete this.attributes[k];}
  matches(selector){return selector.split(',').some(s=>this.matchers.includes(s));}
  querySelector(selector){return (this.selectors[selector] || [])[0] || null;}
  querySelectorAll(selector){return this.selectors[selector] || [];}
  appendChild(node){node.isConnected=true;}
  remove(){this.isConnected=false;}
  getClientRects(){return this.visible ? [{}] : [];}
}
async function fixture(host, config, selectors={}, options={}) {
  const documentElement=new Node(),body=new Node();
  let changed, message, interval, now=10000;
  const sent=[];
  const events=[];let observing=false;
  const document={documentElement,body,querySelectorAll:s=>selectors[s]||[],querySelector:s=>(selectors[s]||[])[0]||null,createElement:()=>new Node(),addEventListener(){},dispatchEvent(event){events.push(event);}};
  const api={storage:{local:{get:async()=>({config})},onChanged:{addListener:fn=>changed=fn}},runtime:{onMessage:{addListener:fn=>message=fn},sendMessage:async data=>(sent.push(data),data.type==='FRAME_CONTEXT'?{ok:true,host:options.topHost}:{ok:true,repaired:true})}};
  const context=vm.createContext({NavegaCore:C,URL,location:{hostname:host,href:'https://'+host+'/'},document,
    getComputedStyle:node=>({display:node.hasAttribute('data-navega-livre-hidden')?'none':'block',visibility:'visible',position:node.position}),
    MutationObserver:class{observe(){observing=true;}disconnect(){observing=false;}},setTimeout:()=>1,clearTimeout(){},setInterval:fn=>(interval=fn,1),clearInterval:()=>interval=null,
    Date:{now:()=>now},addEventListener(){},console,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},
    ...(options.firefox?{browser:api,chrome:{}}:{chrome:api}),...(options.topHost?{top:{}}:{})
  });
  vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {document,sent,events,hasInterval:()=>Boolean(interval),observing:()=>observing,tick:()=>{now+=2000;interval?.();},change:async value=>{changed({config:{newValue:value}},'local');await new Promise(resolve=>setImmediate(resolve));},status:()=>{let result;message({type:'PAGE_STATUS'},{},v=>result=v);return result;}};
}
const gates='[role="dialog"],dialog,[class*="adblock" i],[id*="adblock" i],[class*="anti-adblock" i]';
test('YouTube hides only known ad spaces, clicks available skip, and pauses reversibly',async()=>{
  const ad=new Node(),video=new Node(),button=new Node(),player=new Node();
  let clicks=0;button.disabled=true;button.click=()=>clicks++;
  player.classes.add('ad-showing');player.selectors['video']=[video];player.selectors['.ytp-ad-skip-button']=[button];
  const settings=C.normalizeConfig();
  const f=await fixture('www.youtube.com',settings,{'ytd-ad-slot-renderer':[ad],'#movie_player':[player]});
  assert.equal(ad.getAttribute('data-navega-livre-hidden'),'ad');assert.equal(clicks,0);
  button.disabled=false;f.tick();assert.equal(clicks,1);
  assert.equal(f.status().skipClicks,1);assert.equal(f.status().adsHidden,1);
  await f.change({...settings,disabledHosts:['www.youtube.com']});
  assert.equal(ad.hasAttribute('data-navega-livre-hidden'),false);f.tick();assert.equal(clicks,1);
});
test('muting restores both an originally audible video and an already muted one',async()=>{
  const video=new Node(),player=new Node();player.classes.add('ad-showing');player.selectors['video']=[video];
  const f=await fixture('www.youtube.com',C.normalizeConfig({skipAds:false,muteAds:true}),{'#movie_player':[player]});
  assert.equal(video.muted,true);player.classes.delete('ad-showing');f.tick();assert.equal(video.muted,false);
  video.muted=true;player.classes.add('ad-showing');f.tick();player.classes.delete('ad-showing');f.tick();assert.equal(video.muted,true);
});
test('repair is opt-in, only touches advertising notices, and restores background styles',async()=>{
  const warning=new Node({text:'Desative o bloqueador de anúncios',matches:['[role="dialog"]'],position:'fixed'});
  const login=new Node({text:'Faça login para continuar',matches:['[role="dialog"]']});
  const paid=new Node({text:'Disable your ad blocker and subscribe to premium',matches:['[role="dialog"]']});
  const settings=C.normalizeConfig();const f=await fixture('example.test',settings,{[gates]:[warning,login,paid]});
  f.document.body.style.setProperty('overflow','hidden');assert.equal(warning.hasAttribute('data-navega-livre-hidden'),false);
  await f.change({...settings,repairHosts:['example.test']});
  assert.equal(warning.getAttribute('data-navega-livre-hidden'),'notice');
  assert.equal(login.hasAttribute('data-navega-livre-hidden'),false);assert.equal(paid.hasAttribute('data-navega-livre-hidden'),false);
  assert.equal(f.document.body.style.getPropertyValue('overflow'),'auto');
  await f.change(settings);assert.equal(warning.hasAttribute('data-navega-livre-hidden'),false);
  assert.equal(f.document.body.style.getPropertyValue('overflow'),'hidden');
});
test('the page cannot be modified when protection is globally paused',async()=>{
  const ad=new Node();const f=await fixture('www.youtube.com',C.normalizeConfig({enabled:false}),{'ytd-ad-slot-renderer':[ad]});
  assert.equal(ad.hasAttribute('data-navega-livre-hidden'),false);assert.equal(f.status().active,false);
});
test('generic ad spaces can be restored without pausing network blocking or spinning a timer',async()=>{
  const ad=new Node(),article=new Node();
  const settings=C.normalizeConfig();const f=await fixture('example.test',settings,{'.adsbox':[ad],'article':[article]});
  assert.equal(ad.hasAttribute('data-navega-livre-hidden'),true);assert.equal(article.hasAttribute('data-navega-livre-hidden'),false);
  assert.equal(f.hasInterval(),false);assert.equal(f.observing(),true);
  await f.change({...settings,cosmetics:false});
  assert.equal(ad.hasAttribute('data-navega-livre-hidden'),false);assert.equal(f.status().active,true);
  await f.change({...settings,enabled:false});assert.equal(f.observing(),false);
});
test('a paused top-level site also pauses cosmetics inside a third-party frame',async()=>{
  const ad=new Node();const settings=C.normalizeConfig({disabledHosts:['parent.test']});
  const f=await fixture('frame.test',settings,{'.adsbox':[ad]},{topHost:'parent.test'});
  assert.equal(ad.hasAttribute('data-navega-livre-hidden'),false);assert.equal(f.status().active,false);
  await f.change({...settings,disabledHosts:[]});assert.equal(ad.hasAttribute('data-navega-livre-hidden'),true);
});
test('Firefox preferences cross the page boundary as JSON text and restored nodes are not counted twice',async()=>{
  const ad=new Node(),settings=C.normalizeConfig();
  const f=await fixture('www.youtube.com',settings,{'ytd-ad-slot-renderer':[ad]},{firefox:true});
  assert.equal(typeof f.events[0].detail,'string');assert.equal(JSON.parse(f.events[0].detail).enabled,true);
  await f.change({...settings,enabled:false});assert.equal(JSON.parse(f.events.at(-1).detail).enabled,false);
  await f.change(settings);assert.equal(f.status().adsHidden,1);
});
test('frame cosmetics validate the source hostname instead of matching text anywhere in a URL',async()=>{
  const ad=new Node(),lookalike=new Node(),query=new Node();
  ad.setAttribute('src','https://pagead2.googlesyndication.com/ad');
  lookalike.setAttribute('src','https://doubleclick.net.attacker.test/');
  query.setAttribute('src','https://example.test/?doubleclick.net');
  await fixture('page.test',C.normalizeConfig(),{'iframe[src]':[ad,lookalike,query]});
  assert.equal(ad.hasAttribute('data-navega-livre-hidden'),true);
  assert.equal(lookalike.hasAttribute('data-navega-livre-hidden'),false);assert.equal(query.hasAttribute('data-navega-livre-hidden'),false);
});
