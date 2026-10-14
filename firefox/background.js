'use strict';
if (typeof importScripts === 'function') {
  importScripts('common.js');
}
const C = globalThis.NavegaCore;
const browserApi = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);
const isFirefox = typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined' && !('declarativeNetRequest' in browserApi);

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
  // DeclarativeNetRequest on Chromium
  if (browserApi.declarativeNetRequest) {
    const previous = await browserApi.declarativeNetRequest.getDynamicRules();
    await browserApi.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: previous.map(rule => rule.id), addRules: C.allowRules(value)
    });
    if (browserApi.declarativeNetRequest.updateEnabledRulesets) {
      await browserApi.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: value.enabled ? ['advertising'] : [],
        disableRulesetIds: value.enabled ? [] : ['advertising']
      });
    }
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
}

async function syncYoutubeScript(value) {
  if (!browserApi.scripting || !browserApi.scripting.registerContentScripts) return;
  const id = 'navega-youtube-main';
  const matches = value.enabled && value.youtube
    ? ['youtube.com', 'www.youtube.com', 'm.youtube.com'].filter(host => C.active(value, host)).map(host => '*://' + host + '/*') : [];
  
  try {
    const existing = await browserApi.scripting.getRegisteredContentScripts({ids: [id]});
    if (!matches.length) {
      if (existing.length) await browserApi.scripting.unregisterContentScripts({ids: [id]});
      return;
    }
    const script = {id, matches, js: ['youtube-main.js'], runAt: 'document_start', world: 'MAIN', persistAcrossSessions: true};
    if (existing.length) await browserApi.scripting.updateRegisteredContentScripts([script]);
    else await browserApi.scripting.registerContentScripts([script]);
  } catch (err) {
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
  if (message.type === 'KNOWN_REPAIR') {
    const tab = sender.tab;
    if (!tab?.id || !tab.url) return {ok: false};
    const host = C.normalizeHost(tab.url);
    return {ok: true, repaired: await knownRepair(tab.id, host, await config())};
  }
  
  const extUrl = browserApi.runtime.getURL('');
  if (sender.tab || !sender.url?.startsWith(extUrl)) return {ok: false, error: 'Origem inválida.'};
  
  if (message.type === 'GET_CONFIG') return {ok: true, config: await config()};
  if (message.type === 'SET_OPTION') {
    if (!['enabled', 'youtube', 'skipAds', 'muteAds'].includes(message.key) || typeof message.value !== 'boolean') return {ok: false};
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
    try { page = await browserApi.tabs.sendMessage(tab.id, {type: 'REPAIR_NOW', enabled: message.enabled}); } catch { /* Existing tabs need reload */ }
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
