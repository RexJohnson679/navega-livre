/* Local DOM policies. Site repairs are only called after user opt-in. */
(() => {
  'use strict';
  const C=globalThis.NavegaCore, P=globalThis.NavegaPopupPolicy;
  const roots='html,body,main,article,nav,header,footer,form,[role="main"],#root,#__next';
  const gates='[role="dialog"],dialog,[class*="adblock" i],[id*="adblock" i],[class*="anti-adblock" i],[class*="modal" i],[class*="popup" i]';
  const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
  function protectedNode(node){return !node || node.matches(roots);}
  function dismissControl(node){
    for(const button of node.querySelectorAll('button,[role="button"]')) {
      const name=normalize(button.getAttribute('aria-label')||button.getAttribute('title')||button.textContent);
      if(!button.disabled && button.getAttribute('aria-disabled')!=='true' && button.getClientRects().length && /^(?:fechar|close|dismiss|agora n[aã]o|not now|[×✕✖x])$/i.test(name))return button;
    }return null;
  }
  function knownMixed(node,host,text){
    const base=host.replace(/^www\./,'');
    const title=base==='lycantoons.com'?/precisamos da sua ajuda/i:base==='vegitoons.black'?/detectamos um bloqueador de an[uú]ncios/i:null;
    return Boolean(title && title.test(text) && /(?:desativ|deslig)[\s\S]{0,100}bloqueador/i.test(text) && dismissControl(node));
  }
  function canRepair(node,host){
    if(protectedNode(node) || node.querySelector('input[type="password"]'))return false;
    const text=normalize(node.textContent);if(text.length>2600)return false;
    const s=getComputedStyle(node);
    if(s.display==='none' || s.visibility==='hidden' || !node.getClientRects().length)return false;
    if(s.position!=='fixed' && !node.matches('[role="dialog"],dialog,.adblock-screen'))return false;
    return C.adblockText(text) || knownMixed(node,host,text);
  }
  function noticeCandidates(root,host){
    const found=new Set(root.querySelectorAll(gates));
    if(/^(?:www\.)?(?:lycantoons\.com|vegitoons\.black)$/.test(host)) {
      const walker=document.createTreeWalker(root.body||root,4);let text,count=0;
      while((text=walker.nextNode())&&count++<3000){
        if(!/precisamos da sua ajuda|detectamos um bloqueador de an[uú]ncios/i.test(text.nodeValue||''))continue;
        for(let node=text.parentElement,depth=0;node&&depth<7;node=node.parentElement,depth++){
          if(protectedNode(node))break;
          if(getComputedStyle(node).position==='fixed'||node.matches('[role="dialog"],dialog')){found.add(node);break;}
        }
      }
    }
    return [...found].slice(0,100).filter(node=>canRepair(node,host));
  }
  function isAdvertisingDialog(node){
    if(protectedNode(node)||node.querySelector('input[type="password"]'))return false;
    const text=normalize(node.textContent);if(text.length>1600)return false;
    const s=getComputedStyle(node),r=node.getBoundingClientRect();
    if(!['fixed','absolute'].includes(s.position)||s.display==='none'||r.width<100||r.height<50)return false;
    const badge=[...node.querySelectorAll('span,small,label,div')].slice(0,80).some(el=>/^(?:ad|ads|an[uú]ncio|publicidade|sponsored)$/i.test(normalize(el.textContent)));
    const destination=[...node.querySelectorAll('a[href],iframe[src],img[src]')].slice(0,30).some(el=>P.adUrl(el.getAttribute('href')||el.getAttribute('src'),location.href));
    return badge && (destination || /descarregamento|download|baixar|instalar|passo restante|continue|continuar|claim reward/i.test(text));
  }
  function advertisingDialogs(root){
    const found=new Set(root.querySelectorAll('dialog,[role="dialog"],[class*="vignette" i],[id*="vignette" i],[class*="interstitial" i],[id*="interstitial" i],[class*="popup" i],[class*="overlay" i]'));
    const walker=document.createTreeWalker(root.body||root,4);let text,count=0;
    while((text=walker.nextNode())&&count++<2000){
      if(!/^(?:ad|ads|an[uú]ncio|publicidade|sponsored)$/i.test(normalize(text.nodeValue)))continue;
      for(let node=text.parentElement,depth=0;node&&depth<6;node=node.parentElement,depth++){
        if(protectedNode(node))break;
        if(isAdvertisingDialog(node)){found.add(node);break;}
      }
    }
    return [...found].slice(0,80).filter(isAdvertisingDialog);
  }
  const api={gates,protectedNode,dismissControl,canRepair,noticeCandidates,isAdvertisingDialog,advertisingDialogs};
  globalThis.NavegaNoticePolicy=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
