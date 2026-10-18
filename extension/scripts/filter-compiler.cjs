'use strict';
// Offline conversion of a deliberately supported ABP subset. Unsupported
// syntax is counted and skipped rather than silently widened.
const TYPES = ['script','image','sub_frame','xmlhttprequest','media','ping','other','stylesheet','font','websocket','object'];
const TYPE_MAP = {script:'script',image:'image',subdocument:'sub_frame',xmlhttprequest:'xmlhttprequest',xhr:'xmlhttprequest',media:'media',ping:'ping',other:'other',stylesheet:'stylesheet',font:'font',websocket:'websocket',object:'object'};
const validHost = host => /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) && host.includes('.') && !host.includes('..');
function parseNetwork(line, protectedRoots = []) {
  if (!line || /^[![]/.test(line) || line.includes('##') || line.includes('#@#')) return null;
  const allow = line.startsWith('@@');if (allow) line = line.slice(2);
  const split = line.lastIndexOf('$'), filter = split < 0 ? line : line.slice(0, split);
  const options = split < 0 ? [] : line.slice(split + 1).split(',');
  if (!filter || filter.length > 1200 || /[^\x20-\x7e]/.test(filter) || (filter.startsWith('/') && filter.endsWith('/'))) return null;
  const condition = {}, included = [], excluded = [];let priority = allow ? 10 : 1;
  for (const raw of options) {
    const negative = raw.startsWith('~'), option = negative ? raw.slice(1) : raw;
    if (TYPE_MAP[option]) {(negative ? excluded : included).push(TYPE_MAP[option]);continue;}
    if (option === 'third-party' || option === '3p') {condition.domainType = negative ? 'firstParty' : 'thirdParty';continue;}
    if (option === 'match-case' && !negative) {condition.isUrlFilterCaseSensitive = true;continue;}
    if (option === 'important' && !negative && !allow) {priority = 20;continue;}
    if (option.startsWith('domain=') && !negative) {
      const yes = [], no = [];
      for (const value of option.slice(7).split('|')) {
        const neg = value.startsWith('~'), host = (neg ? value.slice(1) : value).toLowerCase();
        if (!validHost(host)) return null;(neg ? no : yes).push(host);
      }
      if (yes.length) condition.initiatorDomains = [...new Set(yes)].sort();
      if (no.length) condition.excludedInitiatorDomains = [...new Set(no)].sort();
      continue;
    }
    // Main-frame, popup, redirects, procedural rules and unknown flags need
    // other implementations. Never turn them into unconditional blocks.
    return null;
  }
  condition.resourceTypes = (included.length ? [...new Set(included)] : TYPES).filter(t => !excluded.includes(t)).sort();
  if (!condition.resourceTypes.length) return null;
  const domain = filter.match(/^\|\|([a-z0-9.-]+)\^$/i);
  if (domain && !condition.isUrlFilterCaseSensitive) {
    const host = domain[1].toLowerCase();if (!validHost(host) || protectedRoots.includes(host)) return null;
    condition.requestDomains = [host];
  } else condition.urlFilter = filter;
  return {priority, action:{type:allow?'allow':'block'}, condition};
}
function compileNetwork(sources, start, protectedRoots) {
  const grouped = new Map(), ordinary = new Map();let accepted = 0, skipped = 0;
  for (const text of sources) for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();if (!line || line.startsWith('!') || line.startsWith('[')) continue;
    const rule = parseNetwork(line, protectedRoots);
    if (!rule) {skipped++;continue;}accepted++;
    if (rule.condition.requestDomains) {
      const host = rule.condition.requestDomains[0], {requestDomains, ...rest} = rule.condition;
      const key = JSON.stringify({...rule,condition:rest});
      if (!grouped.has(key)) grouped.set(key,{...rule,condition:rest,hosts:new Set()});grouped.get(key).hosts.add(host);
    } else ordinary.set(JSON.stringify(rule), rule);
  }
  const result = [];
  for (const key of [...grouped.keys()].sort()) {
    const {hosts, ...rule} = grouped.get(key), domains = [...hosts].sort();
    for (let i=0;i<domains.length;i+=400) result.push({...rule,condition:{...rule.condition,requestDomains:domains.slice(i,i+400)}});
  }
  result.push(...[...ordinary.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,r])=>r));
  return {rules:result.map((r,i)=>({id:start+i,...r})),accepted,skipped};
}
function compileCosmetics(text, exceptions) {
  const selectors = [...new Set(text.split(/\r?\n/).filter(line=>line.startsWith('##')).map(line=>line.slice(2)).filter(s=>
    s.length < 700 && !/[{};<>]/.test(s) && !/adblock|anti-adblock|paywall|premium|subscribe|subscription|login|sign-in/i.test(s) && !/:(?:style|remove|matches-css|has-text|upward|xpath)\(/.test(s)))].sort();
  const indexes = new Map(selectors.map((s,i)=>[s,'s'+i])), byHost = new Map();let skipped=0;
  for (const line of exceptions.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('!')) continue;
    const parts=line.split('#@#');if (parts.length!==2 || !indexes.has(parts[1])) {skipped++;continue;}
    for (const host of parts[0].split(',')) {
      if (!validHost(host)) {skipped++;continue;}
      if (!byHost.has(host)) byHost.set(host,new Set());byHost.get(host).add(parts[1]);
    }
  }
  const exceptionSelectors = new Set([...byHost.values()].flatMap(set=>[...set]));
  const guard = ':not(html):not(body):not(main):not(article):not(nav):not(header):not(footer):not(form):not(#root):not(#__next)';
  const css = selectors.map(selector=>{
    const id = indexes.get(selector), prefix='html[data-navega-livre-cosmetics="on"]'+(exceptionSelectors.has(selector)?`:not([data-navega-livre-cosmetic-exceptions~="${id}"])`:'');
    return `${prefix} :is(${selector})${guard}{display:none!important}`;
  }).join('\n')+'\n';
  const hosts = [...byHost.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([host,set])=>({host,selectors:[...set].sort(),ids:[...set].map(s=>indexes.get(s)).sort()}));
  return {css, hosts, selectorCount:selectors.length, exceptionCount:hosts.length, skipped};
}
module.exports={TYPES,validHost,parseNetwork,compileNetwork,compileCosmetics};
