const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../common.js'),T=require('../preferences.js');
const source=fs.readFileSync(path.join(__dirname,'../focus.js'),'utf8');
async function fixture(preferences={},config=C.normalizeConfig(),host='www.youtube.com'){
  let data={config,preferences},storageListener;const events={},attrs={},styles=[],listeners=[];
  const root={setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k]||null,removeAttribute:k=>delete attrs[k],hasAttribute:k=>Object.hasOwn(attrs,k)};
  const document={documentElement:root,getElementById:()=>null,addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
  const api={storage:{local:{get:async()=>data},onChanged:{addListener:fn=>{storageListener=fn;listeners.push(fn);},removeListener(){}}}};
  const context=vm.createContext({browser:api,document,location:{hostname:host},
    getComputedStyle:()=>({getPropertyValue:()=> 'nl-071'}),setInterval(){throw Error('Unexpected polling');},
    MutationObserver:class{constructor(){throw Error('Unexpected observer');}},fetch(){throw Error('Unexpected request');}});
  await vm.runInContext(source,context);
  return{context,attrs,events,listeners,state:()=>context.__navegaLivreFocusController?.diagnostics(),
    change:async(key,value)=>{data={...data,[key]:value};await storageListener?.({[key]:{newValue:value}},'local');}};
}
test('focus is self-contained, off by default, and never activates on a lookalike',async()=>{
  assert.deepEqual((await fixture()).attrs,{});
  assert.equal((await fixture({focusShorts:true},C.normalizeConfig(),'youtube.com.evil.test')).state(),undefined);
});
test('focus updates bounded root attributes and reverses on preference change or site pause',async()=>{
  const f=await fixture({focusComments:true,focusRelated:true});
  assert.equal(f.attrs['data-navega-livre-focus-comments'],'on');assert.equal(f.attrs['data-navega-livre-focus-related'],'on');
  await f.change('preferences',{focusShorts:true});assert.equal(f.attrs['data-navega-livre-focus-shorts'],'on');
  assert.equal(f.attrs['data-navega-livre-focus-comments'],undefined);
  await f.change('config',C.normalizeConfig({disabledHosts:['www.youtube.com']}));assert.deepEqual(f.attrs,{});
  await f.change('config',C.normalizeConfig());assert.equal(f.attrs['data-navega-livre-focus-shorts'],'on');
  await f.change('preferences',T.normalize());assert.deepEqual(f.attrs,{});
});
test('focus respects global pause and remains independent from the advertising-player filter',async()=>{
  const f=await fixture({focusShorts:true},C.normalizeConfig({enabled:false}));assert.deepEqual(f.attrs,{});
  await f.change('config',C.normalizeConfig({youtube:false}));assert.equal(f.attrs['data-navega-livre-focus-shorts'],'on');
});
test('repeated injection reuses one controller and one storage listener',async()=>{
  const f=await fixture({focusShorts:true});const controller=f.context.__navegaLivreFocusController;
  await vm.runInContext(source,f.context);await vm.runInContext(source,f.context);
  assert.equal(f.context.__navegaLivreFocusController,controller);assert.equal(f.listeners.length,1);
});
test('YouTube navigation reapplies focus attributes without a DOM observer',async()=>{
  const f=await fixture({focusComments:true});delete f.attrs['data-navega-livre-focus-comments'];
  f.events['yt-navigate-finish']();assert.equal(f.attrs['data-navega-livre-focus-comments'],'on');
});
