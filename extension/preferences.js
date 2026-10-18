/* Optional tools. No network access, request interception, or page polling. */
(() => {
  'use strict';
  const C = globalThis.NavegaCore || (typeof require === 'function' ? require('./common.js') : null);
  const DEFAULTS = Object.freeze({theme: 'system', focusShorts: false, focusComments: false, focusRelated: false});
  const THEMES = ['system', 'dark', 'light'];
  const BACKUP_LIMIT = 524288;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function normalize(raw) {
    const value = {...DEFAULTS};
    if (!record(raw)) return value;
    if (THEMES.includes(raw.theme)) value.theme = raw.theme;
    for (const key of ['focusShorts', 'focusComments', 'focusRelated']) if (typeof raw[key] === 'boolean') value[key] = raw[key];
    return value;
  }
  function cleanLink(input) {
    if (typeof input !== 'string' || input.length > 8192) throw Error('Use um link HTTP ou HTTPS de até 8.192 caracteres.');
    const raw = input.trim();
    let url;
    try { url = new URL(raw); } catch { throw Error('Cole um link completo, começando com https:// ou http://.'); }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw Error('Use um link HTTP ou HTTPS sem usuário e senha.');
    const hashAt = raw.indexOf('#'), end = hashAt < 0 ? raw.length : hashAt;
    const queryAt = raw.indexOf('?');
    if (queryAt < 0 || queryAt > end) return {url: raw, removed: [], protected: false};
    const parts = raw.slice(queryAt + 1, end).split('&');
    const keyOf = part => { try { return decodeURIComponent(part.split('=')[0].replace(/\+/g, ' ')).toLowerCase(); } catch { return ''; } };
    // Keep signed/authenticated links byte-for-byte. Re-encoding can break access.
    if (parts.some(part => /^(?:x-amz-|x-goog-)/.test(keyOf(part)) || /^(?:sig|signature|token|access_token|auth|authorization|jwt|policy|key-pair-id|hmac|expires)$/.test(keyOf(part)))) {
      return {url: raw, removed: [], protected: true};
    }
    const names = new Set(['fbclid', 'gclid', 'dclid', 'msclkid', 'gbraid', 'wbraid', 'mc_cid', 'mc_eid', 'igshid', 'twclid', 'ttclid', 'yclid', '_hsenc', '_hsmi']);
    const removed = [];
    const kept = parts.filter(part => {
      const key = keyOf(part), tracking = key.startsWith('utm_') || names.has(key);
      if (tracking) removed.push(key);
      return !tracking;
    });
    return {url: removed.length ? raw.slice(0, queryAt) + (kept.length ? '?' + kept.join('&') : '') + raw.slice(end) : raw,
      removed: [...new Set(removed)], protected: false};
  }
  function createBackup(config, preferences, version) {
    return {format: 'navega-livre', schema: 1, version: String(version || ''), createdAt: new Date().toISOString(),
      config: C.normalizeConfig(config), preferences: normalize(preferences)};
  }
  function readBackup(text) {
    if (typeof text !== 'string' || text.length > BACKUP_LIMIT) throw Error('O backup deve ter até 512 KB.');
    let data;
    try { data = JSON.parse(text); } catch { throw Error('O arquivo não contém um JSON válido.'); }
    if (!record(data) || data.format !== 'navega-livre' || data.schema !== 1) throw Error('Formato de backup incompatível.');
    const config = data.config, preferences = data.preferences;
    const keys = [...C.OPTIONS, 'disabledHosts', 'repairHosts'];
    if (!record(config) || Object.keys(config).some(key => !keys.includes(key)) || C.OPTIONS.some(key => typeof config[key] !== 'boolean')) {
      throw Error('As opções de proteção do backup são inválidas.');
    }
    for (const key of ['disabledHosts', 'repairHosts']) {
      if (!Array.isArray(config[key]) || config[key].length > 500 || config[key].some(host => typeof host !== 'string' || !host || C.normalizeHost(host) !== host)) {
        throw Error('A lista de sites do backup é inválida.');
      }
    }
    if (!record(preferences) || Object.keys(preferences).some(key => !Object.hasOwn(DEFAULTS, key)) || !THEMES.includes(preferences.theme) ||
        ['focusShorts', 'focusComments', 'focusRelated'].some(key => typeof preferences[key] !== 'boolean')) {
      throw Error('As preferências de aparência e foco são inválidas.');
    }
    return {config: C.normalizeConfig(config), preferences: normalize(preferences)};
  }
  const tools = {DEFAULTS, THEMES, BACKUP_LIMIT, normalize, cleanLink, createBackup, readBackup};
  globalThis.NavegaTools = tools;
  if (typeof module !== 'undefined' && module.exports) module.exports = tools;
})();
