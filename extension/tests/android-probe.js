/* Test-only background instrumentation, never copied to a production package. */
(async()=>{
  const base=__NAVEGA_ANDROID_BASE__, endpoint=__NAVEGA_ANDROID_RESULT__;
  const checks=[],tabs=[];
  console.log('NAVEGA_ANDROID_BEGIN');
  const assert=(value,label)=>{
    if(!value)throw Error(label);checks.push(label);
    console.log('NAVEGA_ANDROID_CHECK',label);
  };
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function until(read,label){
    const end=Date.now()+25000;let last;
    while(Date.now()<end){try{last=await read();if(last)return last;}catch(error){last=String(error);}await sleep(200);}
    throw Error(label+': '+JSON.stringify(last));
  }
  const sender={url:browser.runtime.getURL('popup.html')};
  async function request(message){const result=await handle(message,sender);if(!result.ok)throw Error(JSON.stringify(result));return result;}
  async function inspect(tabId,func,args=[]){return(await browser.scripting.executeScript({target:{tabId},func,args,world:'ISOLATED'}))[0]?.result;}
  async function scriptLoad(tabId,path='adsbygoogle.js'){
    // This is a page subresource test: use the page's MAIN principal/CSP, not
    // the extension's isolated-world policy for insecure localhost requests.
    const execution=await browser.scripting.executeScript({target:{tabId},world:'MAIN',func:async url=>{
      return await new Promise(resolve=>{const node=document.createElement('script');node.src=url+'?probe='+Date.now();
        const timer=setTimeout(()=>{node.remove();resolve('timeout');},10000);
        const finish=value=>{clearTimeout(timer);node.remove();resolve(value);};
        node.onload=()=>finish(true);node.onerror=()=>finish(false);document.head.appendChild(node);});
    },args:[base+'/'+path]});
    const value=execution[0]?.result;
    if(typeof value!=='boolean')throw Error('Script probe lost its document or timed out: '+String(value));
    return value;
  }
  async function reload(tabId,state){
    const before=await inspect(tabId,()=>performance.timeOrigin);
    await browser.tabs.reload(tabId);
    await until(()=>inspect(tabId,(old,expected)=>performance.timeOrigin!==old&&document.readyState==='complete'&&
      document.documentElement.getAttribute('data-navega-livre-cosmetics')===expected,[before,state]),'new document '+state);
  }
  async function report(value){
    console.log('NAVEGA_ANDROID_RESULT',JSON.stringify(value));
    // Navigate a separate QA tab to the loopback receiver. This transport is
    // independent of background cross-origin HTTP policies on Android.
    await browser.tabs.create({url:endpoint+'?payload='+encodeURIComponent(JSON.stringify(value)),active:false});
  }
  try{
    const platform=await browser.runtime.getPlatformInfo();assert(platform.os==='android','native Android platform');
    await queue;await init();await queue;
    assert(networkState.available&&!networkState.error&&networkState.enabledRulesets.length===3,'native DNR rulesets');
    assert(youtubeRegistration.active&&popupRegistration.active,'MAIN script registrations');
    const tab=await browser.tabs.create({url:base+'/page',active:true});tabs.push(tab.id);
    await until(()=>inspect(tab.id,()=>document.readyState==='complete'&&document.documentElement.hasAttribute('data-navega-livre-cosmetics')),'content ready');
    assert(await inspect(tab.id,()=>getComputedStyle(document.querySelector('#ad')).display==='none'&&getComputedStyle(document.querySelector('#reader')).display!=='none'),'advertising hidden and article preserved');
    const popup=await browser.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>window.__navegaLivrePopupState?.()});
    assert(popup[0]?.result?.enabled,'native MAIN popup controller');
    assert(await scriptLoad(tab.id,'control.js'),'normal same-origin script loads');
    assert(!(await scriptLoad(tab.id)),'native DNR blocks advertising script');
    const paused=await request({type:'SET_SITE',tabId:tab.id,enabled:false});
    assert(!paused.network.error&&paused.config.disabledHosts.includes(new URL(base).hostname),'pause preference and native DNR state');
    const allow=await browser.declarativeNetRequest.getDynamicRules();
    assert(allow.some(rule=>rule.action.type==='allowAllRequests'&&new RegExp(rule.condition.regexFilter).test(base+'/page')),'native site allow rule installed');
    await reload(tab.id,'off');
    assert(await scriptLoad(tab.id),'site pause allows the same script');
    await request({type:'SET_SITE',tabId:tab.id,enabled:true});
    await reload(tab.id,'on');
    assert(!(await scriptLoad(tab.id)),'site resume blocks the same script');
    // A hidden document is deferred by the bounded controller. This tab is
    // active, without the action overlay, to exercise native repair directly.
    await request({type:'SET_REPAIR',tabId:tab.id,enabled:true});
    await until(()=>inspect(tab.id,()=>getComputedStyle(document.querySelector('#notice')).display==='none'),'native notice repair');
    assert(await inspect(tab.id,()=>document.body.style.overflow==='auto'),'native repair unlocks scroll');
    await request({type:'SET_REPAIR',tabId:tab.id,enabled:false});
    assert(await inspect(tab.id,()=>getComputedStyle(document.querySelector('#notice')).display!=='none'),'repair reversal');
    // Exercise the packaged stylesheet and Android insertCSS with real mobile
    // elements. The separate Firefox tests cover focus.js host matching.
    await browser.scripting.insertCSS({target:{tabId:tab.id},files:['focus.css'],origin:'user'});
    await inspect(tab.id,()=>{document.documentElement.setAttribute('data-navega-livre-focus-comments','on');});
    assert(await inspect(tab.id,()=>getComputedStyle(document.querySelector('#comments-mobile')).display==='none'),'packaged focus CSS on mobile components');
    await inspect(tab.id,()=>document.documentElement.removeAttribute('data-navega-livre-focus-comments'));
    assert(await inspect(tab.id,()=>getComputedStyle(document.querySelector('#comments-mobile')).display!=='none'),'mobile focus CSS reversal');
    const runtime=await browser.runtime.getBrowserInfo();
    await report({ok:true,platform,browser:runtime.version,checks,scope:'production runtime with one added test background script; local fixture; no live YouTube playback'});
  }catch(error){console.error('NAVEGA_ANDROID_ERROR',String(error),String(error.stack||error));await report({ok:false,error:String(error),stack:String(error.stack||''),checks}).catch(()=>{});}
  finally{for(const id of tabs)await browser.tabs.remove(id).catch(()=>{});}
})();
