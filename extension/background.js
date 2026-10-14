'use strict';
if (typeof importScripts === 'function') {
  importScripts('filter-info.js', 'common.js', 'filter-data.js', 'popup-policy.js');
}
const C = globalThis.NavegaCore;
const P = globalThis.NavegaPopupPolicy;
const browserApi = typeof browser !== 'undefined' ? browser : chrome;
let youtubeRegistration = {active: false, error: null};
let networkState = {available: false, enabledRulesets: [], error: null};
let popupRegistration = {active: false, error: null};
const popupTargets = new Map();
const closedPopups = new Map();
const POPUP_TTL = 15000;

let queue = Promise.resolve();
function serialize(task) {
  const next = queue.then(task);
  queue = next.catch(error => console.error('[Navega Livre]', error.message));
  return next;
}
async function config() {
  const data = await browserApi.storage.local.get('config');
  return C.normalizeConfig(data ? data.config : {});
}

async function applyRules(value) {
  let networkError = null;
  const dnr = browserApi.declarativeNetRequest;
  if (!dnr) {
    networkState = {available: false, enabledRulesets: [], error: 'O bloqueio de rede não está disponível neste navegador.'};
  } else try {
    const previous = await dnr.getDynamicRules();
    await dnr.updateDynamicRules({removeRuleIds: previous.map(rule => rule.id), addRules: C.allowRules(value)});
    const enabled = C.enabledRulesets(value);
    await dnr.updateEnabledRulesets({enableRulesetIds: enabled,
      disableRulesetIds: ['advertising', 'privacy'].filter(id => !enabled.includes(id))});
    const actual = await dnr.getEnabledRulesets();
    networkState = {available: true, enabledRulesets: actual, error: null};
    if (enabled.some(id => !actual.includes(id))) throw new Error('Uma lista de bloqueio não foi ativada.');
  } catch (error) {
    networkState.error = String(error?.message || error).slice(0, 240);
    networkError = error;
  }
  if (browserApi.action && browserApi.action.setBadgeText) {
    await browserApi.action.setBadgeText({text: value.enabled ? '' : 'OFF'});
    if (browserApi.action.setBadgeBackgroundColor) {
      await browserApi.action.setBadgeBackgroundColor({color: '#64748b'});
    }
  } else if (browserApi.browserAction && browserApi.browserAction.setBadgeText) {
    await browserApi.browserAction.setBadgeText({text: value.enabled ? '' : 'OFF'});
    if (browserApi.browserAction.setBadgeBackgroundColor) {
      await browserApi.browserAction.setBadgeBackgroundColor({color: '#64748b'});
    }
  }
  await syncYoutubeScript(value);
  await syncPopupScript(value);
  if (networkError) throw networkError;
}

async function syncPopupScript(value) {
  const scripting = browserApi.scripting;
  const id = 'navega-popup-main';
  if (!scripting?.registerContentScripts) {
    popupRegistration = {active: false, error: 'Registro do protetor de pop-ups indisponível.'};
    return;
  }
  try {
    const existing = await scripting.getRegisteredContentScripts({ids: [id]});
    if (!value.enabled || !value.popups) {
      if (existing.length) await scripting.unregisterContentScripts({ids: [id]});
      popupRegistration = {active: false, error: null};
      popupTargets.clear();
      return;
    }
    const script = {id, matches: ['http://*/*', 'https://*/*'],
      excludeMatches: value.disabledHosts.map(host => '*://' + host + '/*'),
      js: ['filter-data.js', 'popup-policy.js', 'popup-main.js'], runAt: 'document_start',
      world: 'MAIN', allFrames: true, persistAcrossSessions: true};
    const current = existing[0];
    const equal = (a = [], b = []) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
    const unchanged = current && equal(current.matches, script.matches) && equal(current.excludeMatches, script.excludeMatches) &&
      equal(current.js, script.js) && current.runAt === script.runAt && current.world === script.world &&
      current.allFrames === true && current.persistAcrossSessions !== false;
    if (!unchanged) {
      if (current && typeof scripting.updateContentScripts === 'function') await scripting.updateContentScripts([script]);
      else {
        if (current) await scripting.unregisterContentScripts({ids: [id]});
        await scripting.registerContentScripts([script]);
      }
    }
    popupRegistration = {active: true, error: null};
  } catch (error) {
    popupRegistration = {active: false, error: String(error?.message || error).slice(0, 240)};
    console.warn('[Navega Livre] Popup registration warning:', error);
  }
}

function prunePopupTargets() {
  const now = Date.now();
  for (const [id, entry] of popupTargets) if (now - entry.created > POPUP_TTL) popupTargets.delete(id);
  while (popupTargets.size > 200) popupTargets.delete(popupTargets.keys().next().value);
}
async function closeKnownPopup(tabId, hint) {
  const entry = popupTargets.get(tabId);
  if (!entry || entry.closing || Date.now() - entry.created > POPUP_TTL || !P) return;
  const value = await config();
  if (!value.enabled || !value.popups) return;
  let source, target;
  try { [source, target] = await Promise.all([browserApi.tabs.get(entry.sourceTabId), browserApi.tabs.get(tabId)]); }
  catch { popupTargets.delete(tabId); return; }
  const host = C.normalizeHost(source.url || '');
  if (!host || !C.active(value, host)) return;
  const blank = !target.url || target.url === 'about:blank';
  if (!P.adUrl(target.url) && !P.adUrl(target.pendingUrl) && !(blank && P.adUrl(hint))) return;
  // Recheck after asynchronous reads; never close the source or an unrelated tab.
  if (popupTargets.get(tabId) !== entry || entry.closing || !browserApi.tabs.remove) return;
  entry.closing = true;
  try {
    await browserApi.tabs.remove(tabId);
    closedPopups.set(entry.sourceTabId, (closedPopups.get(entry.sourceTabId) || 0) + 1);
    while (closedPopups.size > 200) closedPopups.delete(closedPopups.keys().next().value);
  } finally { popupTargets.delete(tabId); }
}
if (browserApi.webNavigation?.onCreatedNavigationTarget) {
  browserApi.webNavigation.onCreatedNavigationTarget.addListener(details => {
    if (!Number.isInteger(details.sourceTabId) || !Number.isInteger(details.tabId) || details.tabId === details.sourceTabId) return;
    prunePopupTargets();
    popupTargets.set(details.tabId, {sourceTabId: details.sourceTabId, created: Date.now(), closing: false});
    return closeKnownPopup(details.tabId, details.url).catch(() => {});
  });
  browserApi.webNavigation.onBeforeNavigate?.addListener(details => {
    if (details.frameId === 0) return closeKnownPopup(details.tabId, details.url).catch(() => {});
  });
}
browserApi.tabs?.onUpdated?.addListener((tabId, change) => {
  if (change.url) return closeKnownPopup(tabId, change.url).catch(() => {});
});
browserApi.tabs?.onRemoved?.addListener(tabId => {
  popupTargets.delete(tabId); closedPopups.delete(tabId);
  for (const [id, entry] of popupTargets) if (entry.sourceTabId === tabId) popupTargets.delete(id);
});

async function syncYoutubeScript(value) {
  if (!browserApi.scripting || !browserApi.scripting.registerContentScripts) {
    youtubeRegistration = {active: false, error: 'Este navegador não disponibiliza registro de scripts.'};
    return;
  }
  const id = 'navega-youtube-main';
  const matches = value.enabled && value.youtube
    ? ['youtube.com', 'www.youtube.com', 'm.youtube.com'].filter(host => C.active(value, host)).map(host => '*://' + host + '/*') : [];
  
  try {
    const existing = await browserApi.scripting.getRegisteredContentScripts({ids: [id]});
    if (!matches.length) {
      if (existing.length) await browserApi.scripting.unregisterContentScripts({ids: [id]});
      youtubeRegistration = {active: false, error: null};
      return;
    }
    const script = {id, matches, js: ['youtube-main.js'], runAt: 'document_start', world: 'MAIN', allFrames: false, persistAcrossSessions: true};
    const current = existing[0];
    const sameList = (left, right) => Array.isArray(left) && left.length === right.length &&
      [...left].sort().every((item, index) => item === [...right].sort()[index]);
    const unchanged = current && sameList(current.matches, script.matches) && sameList(current.js, script.js) &&
      current.runAt === script.runAt && current.world === script.world && !current.allFrames && current.persistAcrossSessions !== false;
    if (!unchanged) {
      if (current && typeof browserApi.scripting.updateContentScripts === 'function') {
        await browserApi.scripting.updateContentScripts([script]);
      } else {
        if (current) await browserApi.scripting.unregisterContentScripts({ids: [id]});
        await browserApi.scripting.registerContentScripts([script]);
      }
    }
    youtubeRegistration = {active: true, error: null};
  } catch (err) {
    youtubeRegistration = {active: false, error: String(err?.message || err).slice(0, 240)};
    console.warn('[Navega Livre] Content script registration warning:', err);
  }
}

async function init() {
  const value = await config();
  await browserApi.storage.local.set({config: value});
  await applyRules(value);
}

if (browserApi.runtime && browserApi.runtime.onInstalled) {
  browserApi.runtime.onInstalled.addListener(() => serialize(init));
}
if (browserApi.runtime && browserApi.runtime.onStartup) {
  browserApi.runtime.onStartup.addListener(() => serialize(init));
}
if (browserApi.storage && browserApi.storage.onChanged) {
  browserApi.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.config) {
      serialize(() => applyRules(C.normalizeConfig(changes.config.newValue)));
    }
  });
}

function repairKnownGuard() {
  const element = document.querySelector('.adblock-guard-content');
  const key = Object.keys(element || {}).find(k => k.startsWith('__reactFiber$'));
  let fiber = element?.[key];
  while (fiber && !(typeof fiber.type === 'function' &&
    fiber.type.toString().includes('adblock-guard-content'))) fiber = fiber.return;
  const probe = fiber?.memoizedState;
  const advertising = probe?.next?.next;
  if (!probe?.queue?.dispatch || !advertising?.queue?.dispatch) return false;
  probe.queue.dispatch('allowed');
  advertising.queue.dispatch('unavailable');
  return true;
}

async function knownRepair(tabId, host, value) {
  if (!C.active(value, host) || !value.repairHosts.includes(host)) return false;
  if (!(host === 'tavvkkj.xyz' || host.endsWith('.tavvkkj.xyz'))) return false;
  if (!browserApi.scripting || !browserApi.scripting.executeScript) return false;
  try {
    const results = await browserApi.scripting.executeScript({
      target: {tabId}, world: 'MAIN', func: repairKnownGuard
    });
    return results.some(result => result.result === true);
  } catch {
    return false;
  }
}

async function handle(message, sender) {
  if (!message || typeof message.type !== 'string') return {ok: false, error: 'Pedido inválido.'};
  if (message.type === 'FRAME_CONTEXT') {
    if (!sender.tab) return {ok: false};
    return {ok: true, host: C.normalizeHost(sender.tab.url || '')};
  }
  if (message.type === 'KNOWN_REPAIR') {
    if (sender.frameId > 0) return {ok: true, repaired: false};
    const tab = sender.tab;
    if (!tab?.id || !tab.url) return {ok: false};
    const host = C.normalizeHost(tab.url);
    return {ok: true, repaired: await knownRepair(tab.id, host, await config())};
  }
  
  const extUrl = browserApi.runtime.getURL('');
  if (!sender.url?.startsWith(extUrl) || (sender.tab?.url && !sender.tab.url.startsWith(extUrl))) return {ok: false, error: 'Origem inválida.'};
  
  if (message.type === 'GET_CONFIG') {
    await queue;
    return {ok: true, config: await config(), network: networkState, popups: popupRegistration, filters: C.FILTER_INFO};
  }
  if (message.type === 'GET_POPUP_DIAGNOSTIC') {
    await queue;
    const tab = await browserApi.tabs.get(message.tabId);
    let main = {installed: false}, error = null;
    if (C.normalizeHost(tab.url || '')) try {
      const results = await browserApi.scripting.executeScript({target: {tabId: tab.id}, world: 'MAIN', func: () => {
        const read = (typeof window === 'object' ? window : globalThis).__navegaLivrePopupState;
        if (typeof read !== 'function') return {installed: false};
        const raw = read(), safe = {installed: raw?.installed === true, enabled: raw?.enabled === true};
        safe.version = typeof raw?.version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(raw.version) ? raw.version : null;
        for (const key of ['popupsBlocked', 'linksBlocked', 'dialogsBlocked']) safe[key] =
          typeof raw?.[key] === 'number' && Number.isFinite(raw[key]) ? Math.max(0, raw[key]) : 0;
        return safe;
      }});
      if (results[0]?.result) main = results[0].result;
    } catch (err) { error = String(err?.message || err).slice(0, 240); }
    return {ok: true, registration: popupRegistration, main, error,
      tabsClosed: closedPopups.get(tab.id) || 0, expectedVersion: browserApi.runtime.getManifest().version};
  }
  if (message.type === 'GET_YOUTUBE_DIAGNOSTIC') {
    await queue;
    const tab = await browserApi.tabs.get(message.tabId);
    if (!C.youtubeHost(tab.url || '')) return {ok: true, youtube: false};
    let main = {installed: false}, error = null;
    try {
      const results = await browserApi.scripting.executeScript({target: {tabId: tab.id}, world: 'MAIN', func: () => {
        const read = (typeof window === 'object' ? window : globalThis).__navegaLivreYoutubeState;
        if (typeof read !== 'function') return {installed: false};
        const raw = read();
        const safe = {installed: raw?.installed === true, enabled: raw?.enabled === true};
        safe.version = typeof raw?.version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(raw.version) ? raw.version : null;
        for (const key of ['fetchMatched', 'xhrMatched', 'initialObjectsCleaned', 'embeddedResponsesCleaned', 'adFieldsRemoved', 'parseFailures']) {
          safe[key] = typeof raw?.[key] === 'number' && Number.isFinite(raw[key]) ? Math.max(0, raw[key]) : 0;
        }
        return safe;
      }});
      if (results[0]?.result && typeof results[0].result === 'object') main = results[0].result;
    } catch (err) { error = String(err?.message || err).slice(0, 240); }
    return {ok: true, youtube: true, registration: youtubeRegistration, main, error,
      expectedVersion: browserApi.runtime.getManifest().version};
  }
  if (message.type === 'SET_OPTION') {
    if (!C.OPTIONS.includes(message.key) || typeof message.value !== 'boolean') return {ok: false};
    return serialize(async () => {
      const value = await config();
      value[message.key] = message.value;
      await applyRules(value);
      await browserApi.storage.local.set({config: value});
      return {ok: true, config: value};
    });
  }
  if (message.type === 'SET_SITE') {
    const tab = await browserApi.tabs.get(message.tabId);
    const host = C.normalizeHost(tab.url);
    if (!host || typeof message.enabled !== 'boolean') return {ok: false, error: 'Abra um site HTTP ou HTTPS.'};
    return serialize(async () => {
      const value = await config();
      value.disabledHosts = value.disabledHosts.filter(item => item !== host);
      if (!message.enabled) value.disabledHosts.push(host);
      value.disabledHosts.sort();
      await applyRules(value);
      await browserApi.storage.local.set({config: value});
      return {ok: true, config: value};
    });
  }
  if (message.type === 'SET_REPAIR') {
    const tab = await browserApi.tabs.get(message.tabId);
    const host = C.normalizeHost(tab.url);
    if (!host || typeof message.enabled !== 'boolean') return {ok: false};
    const value = await serialize(async () => {
      const value = await config();
      value.repairHosts = value.repairHosts.filter(item => item !== host);
      if (message.enabled) value.repairHosts.push(host);
      await browserApi.storage.local.set({config: value});
      return value;
    });
    let known = false;
    if (message.enabled) known = await knownRepair(tab.id, host, value);
    let page = null;
    try { page = await browserApi.tabs.sendMessage(tab.id, {type: 'REPAIR_NOW', enabled: message.enabled}, {frameId: 0}); } catch { /* Existing tabs need reload */ }
    return {ok: true, config: value, known, page};
  }
  return {ok: false, error: 'Operação desconhecida.'};
}

if (browserApi.runtime && browserApi.runtime.onMessage) {
  browserApi.runtime.onMessage.addListener((message, sender, respond) => {
    handle(message, sender).then(respond).catch(error => respond({ok: false, error: error.message}));
    return true;
  });
}
serialize(async () => applyRules(await config()));
