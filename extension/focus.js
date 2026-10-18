/* Self-contained focus controller. No polling or mutation observers. */
(() => {
  'use strict';
  const VERSION='0.7.1', MARKER='nl-071';
  const api=typeof browser!=='undefined'?browser:chrome;
  const hosts=['youtube.com','www.youtube.com','m.youtube.com'];
  if(!hosts.includes(location.hostname))return;
  const previous=globalThis.__navegaLivreFocusController;
  if(previous?.version===VERSION)return previous.reload();
  previous?.stop?.();
  const keys=['focusShorts','focusComments','focusRelated'];
  const attrs={focusShorts:'data-navega-livre-focus-shorts',focusComments:'data-navega-livre-focus-comments',focusRelated:'data-navega-livre-focus-related'};
  let flags={},active=false,loaded=false,generation=0,stopped=false;
  function diagnostics(){
    let cssLoaded=false;
    try{cssLoaded=getComputedStyle(document.documentElement).getPropertyValue('--navega-livre-focus-version').trim()===MARKER;}catch{}
    return {installed:true,version:VERSION,loaded,active,cssLoaded,...flags};
  }
  function render(){
    const root=document.documentElement;
    if(!root)return;
    // Retire the inline stylesheet used by 0.7.0, if still present.
    const legacy=document.getElementById('navega-livre-focus');
    if(legacy?.tagName==='STYLE')legacy.remove();
    for(const key of keys){
      if(loaded&&active&&flags[key]){if(root.getAttribute(attrs[key])!=='on')root.setAttribute(attrs[key],'on');}
      else if(root.hasAttribute(attrs[key]))root.removeAttribute(attrs[key]);
    }
  }
  async function reload(){
    const ticket=++generation;
    try{
      const data=await api.storage.local.get(['config','preferences']);
      if(stopped||ticket!==generation)return diagnostics();
      const config=data.config||{},preferences=data.preferences||{};
      active=config.enabled!==false&&!(Array.isArray(config.disabledHosts)&&config.disabledHosts.includes(location.hostname));
      for(const key of keys)flags[key]=preferences[key]===true;
      loaded=true;render();return diagnostics();
    }catch(error){
      if(ticket===generation){loaded=false;active=false;render();}
      return {...diagnostics(),error:String(error?.message||error).slice(0,160)};
    }
  }
  function changed(changes,area){if(area==='local'&&(changes.config||changes.preferences))return reload();}
  function navigated(){if(!stopped)render();}
  function restored(event){if(event.persisted)return reload();}
  function stop(){
    stopped=true;generation++;loaded=false;render();
    api.storage.onChanged.removeListener?.(changed);
    document.removeEventListener('yt-navigate-finish',navigated);
    document.removeEventListener('yt-page-data-updated',navigated);
    globalThis.removeEventListener?.('pageshow',restored);
  }
  api.storage.onChanged.addListener(changed);
  document.addEventListener('yt-navigate-finish',navigated);
  document.addEventListener('yt-page-data-updated',navigated);
  globalThis.addEventListener?.('pageshow',restored);
  globalThis.__navegaLivreFocusController={version:VERSION,reload,diagnostics,stop};
  return reload();
})();
