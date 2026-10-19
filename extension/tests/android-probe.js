/* Test-only background instrumentation, never copied to a production package. */
(async()=>{
  const base=__NAVEGA_ANDROID_BASE__, endpoint=__NAVEGA_ANDROID_RESULT__;
  const checks=[],tabs=[];
  console.log('NAVEGA_ANDROID_BEGIN');
  const assert=(value,label)=>{
    if(!value)throw Error(label);checks.push(label);
    console.log('NAVEGA_ANDROID_CHECK',label);
    void fetch(endpoint.replace('/result/','/progress/'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({check:label})}).catch(()=>{});
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
  async function scriptLoad(tabId){return inspect(tabId,async url=>{
    return await new Promise(resolve=>{const node=document.createElement('script');node.src=url+'?probe='+Date.now();
      node.onload=()=>{node.remove();resolve(true);};node.onerror=()=>{node.remove();resolve(false);};document.head.appendChild(node);});
  },[base+'/adsbygoogle.js']);}
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
    assert(!(await scriptLoad(tab.id)),'native DNR blocks advertising script');
    await request({type:'SET_SITE',tabId:tab.id,enabled:false});
    await browser.tabs.reload(tab.id);
    await until(()=>inspect(tab.id,()=>document.readyState==='complete'&&document.documentElement.getAttribute('data-navega-livre-cosmetics')==='off'),'paused page ready');
    assert(await scriptLoad(tab.id),'site pause allows the same script');
    await request({type:'SET_SITE',tabId:tab.id,enabled:true});
    await browser.tabs.reload(tab.id);
    await until(()=>inspect(tab.id,()=>document.readyState==='complete'&&document.documentElement.getAttribute('data-navega-livre-cosmetics')==='on'),'resumed page ready');
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
    await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,platform,browser:runtime.version,checks,scope:'production runtime with one added test background script; local fixture; no live YouTube playback'})});
  }catch(error){console.error('NAVEGA_ANDROID_ERROR',String(error.stack||error));await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:String(error.stack||error),checks})}).catch(()=>{});}
  finally{for(const id of tabs)await browser.tabs.remove(id).catch(()=>{});}
})();
