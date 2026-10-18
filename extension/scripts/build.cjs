'use strict';
// Deterministic, offline build. No remote code or downloaded runtime lists.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {compileNetwork, compileCosmetics} = require('./filter-compiler.cjs');
const root = path.resolve(__dirname, '..');
const provenance=JSON.parse(fs.readFileSync(path.join(root,'filters/provenance.json')));
for(const item of [...provenance.easylist.files,provenance.hagezi]) {
  const bytes=fs.readFileSync(path.join(root,'filters',item.localPath));
  const hash=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(hash!==item.gitBlobSha)throw Error('Source snapshot differs from its recorded upstream blob: '+item.localPath);
}
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'filters/catalog.json')));
const snapshot = fs.readFileSync(path.join(root, 'filters/sources/stevenblack-own.hosts'), 'utf8');
const valid = host => /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) && host.includes('.') && !host.includes('..');
function domains(items) {
  return [...new Set(items.map(s => s.toLowerCase().replace(/\.$/, '')))].filter(host => {
    if (!valid(host) || catalog.excludedHosts.includes(host) || catalog.protectedRoots.includes(host)) return false;
    // Preserve all media/player hosts, including descendants.
    if (['youtube.com', 'googlevideo.com', 'ytimg.com', 'youtubei.googleapis.com'].some(root => host === root || host.endsWith('.' + root))) return false;
    return true;
  }).sort();
}
const contributed = snapshot.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^0\.0\.0\.0\s+([a-zA-Z0-9.-]+)(?:\s|$)/);
  return match ? [match[1]] : [];
});
const privacy = domains(catalog.privacy);
const ads = domains([...catalog.advertising, ...contributed]).filter(host =>
  !privacy.some(root => host === root || host.endsWith('.' + root)));
const types = ['script', 'image', 'sub_frame', 'xmlhttprequest', 'media', 'ping', 'other', 'stylesheet', 'font', 'websocket'];
function blockRules(list, start) {
  const rules = [];
  for (let i = 0; i < list.length; i += 400) rules.push({id: start + rules.length, priority: 1,
    action: {type: 'block'}, condition: {requestDomains: list.slice(i, i + 400), domainType: 'thirdParty', resourceTypes: types}});
  return rules;
}
const sourceDirectory = path.join(root, 'filters/sources/easylist');
const readLists = names => names.map(name => fs.readFileSync(path.join(sourceDirectory,name),'utf8'));
const importedAds = compileNetwork(readLists(['easylist_adservers.txt','easylist_general_block.txt','easylist_allowlist.txt']),10000,catalog.protectedRoots);
const importedPrivacy = compileNetwork(readLists(['easyprivacy_trackingservers.txt','easyprivacy_trackingservers_general.txt','easyprivacy_trackingservers_international.txt','easyprivacy_trackingservers_thirdparty.txt','easyprivacy_general.txt','easyprivacy_thirdparty.txt','easyprivacy_thirdparty_international.txt','easyprivacy_specific.txt','easyprivacy_specific_international.txt','easyprivacy_allowlist.txt','easyprivacy_allowlist_international.txt']),100000,catalog.protectedRoots);
const advertising = [...blockRules(ads, 1),...importedAds.rules];
// These are real script-path rules, not benchmark-specific substitutions.
for (const regexFilter of [
  '^https?://[^/]+/(?:[^?#]*/)?(?:adsbygoogle|show_ads|pagead|prebid(?:[.-][^/?#]*)?)\\.js(?:[?#]|$)',
  '^https?://[^/]+/widget/ads\\.[^/?#]+(?:[?#]|$)'
]) advertising.push({id: 800 + advertising.length, priority: 1, action: {type: 'block'}, condition: {regexFilter, resourceTypes: ['script']}});
const tracking = [...blockRules(privacy, 2000),...importedPrivacy.rules];
// HaGeZi data retains its separate GPL-3.0 ruleset and privacy toggle.
const hagezi = fs.readFileSync(path.join(root,'filters/sources/hagezi-light.txt'),'utf8');
const hageziDomains = domains(hagezi.split(/\r?\n/).flatMap(line=>{const m=line.match(/^\|\|([a-z0-9.-]+)\^$/);return m?[m[1]]:[];}));
const extendedTracking = blockRules(hageziDomains,200000);
if (advertising.length+tracking.length+extendedTracking.length > 30000) throw Error('Static rules exceed the guaranteed browser budget.');
const importedDomains = importedAds.rules.filter(r=>r.action.type==='block'&&!r.condition.initiatorDomains&&!r.condition.excludedInitiatorDomains).flatMap(r=>r.condition.requestDomains||[]);
const allAds = domains([...ads,...importedDomains]);
const allPrivacy = domains([...privacy,...importedPrivacy.rules.filter(r=>r.action.type==='block').flatMap(r=>r.condition.requestDomains||[])]);
const cosmetics = compileCosmetics(...readLists(['easylist_general_hide.txt','easylist_allowlist_general_hide.txt']));
const projectVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
const info = {version: projectVersion, snapshotDate: '2026-10-15', advertisingDomains: allAds.length,
  privacyDomains: allPrivacy.length, extendedPrivacyDomains:hageziDomains.length,
  totalDomains: new Set([...advertising,...tracking,...extendedTracking].flatMap(r=>r.condition.requestDomains||[])).size,
  advertisingRules: advertising.length, privacyRules: tracking.length, extendedPrivacyRules:extendedTracking.length,
  cosmeticSelectors: cosmetics.selectorCount, cosmeticExceptionHosts: cosmetics.exceptionCount,
  importedFilters: {advertising:importedAds.accepted,privacy:importedPrivacy.accepted,skippedAdvertising:importedAds.skipped,skippedPrivacy:importedPrivacy.skipped},
  source: 'EasyList/EasyPrivacy subset + HaGeZi Light + StevenBlack own contributions + curated catalog',
  sourceSha256: crypto.createHash('sha256').update(snapshot).digest('hex')};
fs.mkdirSync(path.join(root, 'rules'), {recursive: true});
fs.writeFileSync(path.join(root, 'rules/advertising.json'), JSON.stringify(advertising, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'rules/privacy.json'), JSON.stringify(tracking, null, 2) + '\n');
fs.writeFileSync(path.join(root,'rules/privacy-extended.json'),JSON.stringify(extendedTracking,null,2)+'\n');
fs.writeFileSync(path.join(root, 'filter-data.js'), '/* Offline advertising domain data. Includes EasyList material, CC BY-SA 3.0; see filters/LICENSE-EasyList.txt. */\n(() => {\n  const data = Object.freeze({advertising: Object.freeze(' + JSON.stringify(allAds) + ')});\n  globalThis.NavegaBlockingData = data;\n  if (typeof module !== "undefined" && module.exports) module.exports = data;\n})();\n');
fs.writeFileSync(path.join(root,'cosmetic-filters.css'),'/* EasyList-derived selectors, CC BY-SA 3.0; see filters/LICENSE-EasyList.txt. */\n'+cosmetics.css);
fs.writeFileSync(path.join(root,'cosmetic-data.js'),'/* EasyList-derived exceptions, CC BY-SA 3.0. */\n(() => { const data='+JSON.stringify({exceptions:cosmetics.hosts})+'; globalThis.NavegaCosmeticData=data; if(typeof module!=="undefined"&&module.exports)module.exports=data; })();\n');
fs.writeFileSync(path.join(root, 'filter-info.js'), '/* Generated by scripts/build.cjs */\n(() => {\n  const info = ' + JSON.stringify(info, null, 2) + ';\n  globalThis.NavegaFilterInfo = Object.freeze(info);\n  if (typeof module !== "undefined" && module.exports) module.exports = info;\n})();\n');
// MAIN gets a unique, self-contained entry. Do not reuse the isolated-world
// helper filenames: all policy/data dependencies must execute in this world.
fs.writeFileSync(path.join(root, 'popup-main-bundle.js'), '/* Generated offline by scripts/build.cjs. */\n' +
  ['filter-data.js', 'popup-policy.js', 'popup-main.js'].map(name =>
    fs.readFileSync(path.join(root, name), 'utf8')).join('\n;\n'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
manifest.version = info.version;
manifest.content_scripts = [
  {matches: ['*://youtube.com/*', '*://www.youtube.com/*', '*://m.youtube.com/*'], js: ['filter-info.js', 'common.js', 'youtube-bridge.js'], run_at: 'document_start'},
  {matches: ['http://*/*', 'https://*/*'], js: ['filter-info.js', 'common.js', 'popup-bridge.js', 'filter-data.js', 'popup-policy.js', 'cosmetic-data.js', 'notice-policy.js', 'notice-repair.js', 'content.js'], css: ['cosmetic.css','cosmetic-filters.css'], run_at: 'document_start', all_frames: true},
  {matches: ['*://youtube.com/*', '*://www.youtube.com/*', '*://m.youtube.com/*'], js: ['focus.js'], css: ['focus.css'], run_at: 'document_idle'}
];
manifest.options_ui = {page: 'options.html', open_in_tab: true};
manifest.permissions = [...new Set([...manifest.permissions, 'webNavigation'])];
manifest.declarative_net_request = {rule_resources: [
  {id: 'advertising', enabled: true, path: 'rules/advertising.json'},
  {id: 'privacy', enabled: true, path: 'rules/privacy.json'},
  {id: 'privacyExtended',enabled:true,path:'rules/privacy-extended.json'}
]};
const target = process.argv[2];
if (target) {
  if (!['chromium', 'firefox'].includes(target)) throw Error('Use chromium ou firefox.');
  const destination = path.resolve(process.argv[3] || path.join(root, 'dist', target));
  if (destination === root || root.startsWith(destination + path.sep)) throw Error('Escolha uma pasta de saída fora da origem.');
  if (destination.startsWith(root + path.sep) && !destination.startsWith(path.join(root, 'dist') + path.sep)) throw Error('Saídas dentro da origem devem ficar em dist/.');
  fs.mkdirSync(destination, {recursive: true});
  for (const entry of fs.readdirSync(root)) {
    if (['dist', '.git', '_metadata', 'manifest.json','tests','scripts','package.json','RELATORIO.md'].includes(entry) || path.resolve(root, entry) === destination) continue;
    fs.cpSync(path.join(root, entry), path.join(destination, entry), {recursive: true});
  }
  if (target === 'firefox') {
    delete manifest.minimum_chrome_version;
    manifest.browser_specific_settings = {gecko: {id: 'navega-livre@local.extension', strict_min_version: '128.0', data_collection_permissions:{required:['none']}}};
    manifest.background = {scripts: ['filter-info.js', 'common.js', 'preferences.js', 'filter-data.js', 'popup-policy.js', 'background.js']};
  } else {
    delete manifest.browser_specific_settings;
    manifest.minimum_chrome_version = '120';
    manifest.background = {service_worker: 'background.js'};
  }
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
} else fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({target: target || 'source', ...info}));
