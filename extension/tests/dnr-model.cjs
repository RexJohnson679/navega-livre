'use strict';
// Test-only matcher for the fields emitted by this compiler. Native DNR is
// exercised separately in the installed-browser suite; this is not a PSL engine.
function suffix(host,domain){return host===domain||host.endsWith('.'+domain);}
function urlPattern(filter){
  let prefix='',suffixAnchor='';
  if(filter.startsWith('||')){prefix='^[a-z]+://(?:[^/?#]*\\.)?';filter=filter.slice(2);}
  else if(filter.startsWith('|')){prefix='^';filter=filter.slice(1);}
  if(filter.endsWith('|')){suffixAnchor='$';filter=filter.slice(0,-1);}
  let pattern='';for(const char of filter)pattern+=char==='*'?'.*':char==='^'?'(?:[^A-Za-z0-9_%.-]|$)':char.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return prefix+pattern+suffixAnchor;
}
function matching(url,initiator,type,rules){
  const target=new URL(url),source=new URL(initiator),sameParty=target.hostname.split('.').slice(-2).join('.')===source.hostname.split('.').slice(-2).join('.');
  return rules.filter(rule=>{const c=rule.condition;
    if(c.resourceTypes&&!c.resourceTypes.includes(type))return false;
    if(c.domainType==='thirdParty'&&sameParty || c.domainType==='firstParty'&&!sameParty)return false;
    if(c.requestDomains&&!c.requestDomains.some(d=>suffix(target.hostname,d)))return false;
    if(c.excludedRequestDomains?.some(d=>suffix(target.hostname,d)))return false;
    if(c.initiatorDomains&&!c.initiatorDomains.some(d=>suffix(source.hostname,d)))return false;
    if(c.excludedInitiatorDomains?.some(d=>suffix(source.hostname,d)))return false;
    if(c.regexFilter&&!new RegExp(c.regexFilter).test(url))return false;
    if(c.urlFilter&&!new RegExp(urlPattern(c.urlFilter),c.isUrlFilterCaseSensitive?'':'i').test(url))return false;
    return true;
  }).sort((a,b)=>b.priority-a.priority||(a.action.type==='allow'?-1:1));
}
function blocked(url,initiator,type,rules){return matching(url,initiator,type,rules)[0]?.action.type==='block';}
module.exports={blocked,matching,urlPattern};
