/* Local, experimental advertising metadata filtering. No changes to media
 * URLs, account state, content authorization, or player timing. */
(() => {
  'use strict';
  if (globalThis.__navegaLivreYoutubeInstalled) return;
  globalThis.__navegaLivreYoutubeInstalled = true;
  let enabled = true;
  const state = {version: '0.2.0', startedAt: Date.now(), fetchMatched: 0,
    xhrMatched: 0, initialObjectsCleaned: 0, adFieldsRemoved: 0, parseFailures: 0};
  Object.defineProperty(globalThis, '__navegaLivreYoutubeState', {
    configurable: true, value: () => ({...state, installed: true, enabled})
  });
  const AD_KEYS = new Set(['playerAds', 'adPlacements', 'adSlots']);
  function clean(value) {
    let removed = 0, budget = 15000;
    const visited = new WeakSet();
    function visit(object, depth) {
      if (!object || typeof object !== 'object' || depth > 12 || --budget < 0 || visited.has(object)) return;
      visited.add(object);
      for (const key of Object.keys(object)) {
        if (AD_KEYS.has(key)) {
          try { if (delete object[key]) removed++; } catch { /* Preserve protected fields. */ }
        } else visit(object[key], depth + 1);
      }
    }
    visit(value, 0);
    state.adFieldsRemoved += removed;
    return removed;
  }
  function filterText(text) {
    const prefix = text.match(/^\)\]\}'(?:\r?\n)?/)?.[0] || '';
    try {
      const value = JSON.parse(text.slice(prefix.length));
      return clean(value) ? prefix + JSON.stringify(value) : null;
    } catch { state.parseFailures++; return null; }
  }
  function playerEndpoint(input) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
      const trusted = url.origin === location.origin ||
        ['https://www.youtube.com', 'https://youtube.com', 'https://youtubei.googleapis.com'].includes(url.origin);
      return trusted && /^\/youtubei\/v1\/(?:player|next|reel\/reel_watch_sequence)\/?$/.test(url.pathname);
    } catch { return false; }
  }
  for (const key of ['ytInitialPlayerResponse', 'ytInitialData']) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
      if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) continue;
      let value = globalThis[key];
      if (enabled && clean(value)) state.initialObjectsCleaned++;
      Object.defineProperty(globalThis, key, {
        configurable: true, enumerable: true,
        get() { return value; },
        set(next) { value = next; if (enabled && clean(value)) state.initialObjectsCleaned++; }
      });
    } catch { /* Leave protected properties unchanged. */ }
  }
  if (typeof globalThis.fetch === 'function') {
    const original = globalThis.fetch;
    globalThis.fetch = async function(input) {
      const response = await Reflect.apply(original, this, arguments);
      if (!enabled || !response.ok || !playerEndpoint(input)) return response;
      state.fetchMatched++;
      try {
        const text = await response.clone().text();
        if (!enabled) return response;
        const cleaned = filterText(text);
        if (cleaned === null) return response;
        const headers = new Headers(response.headers);
        headers.delete('content-length'); headers.delete('content-encoding');
        const result = new Response(cleaned, {status: response.status, statusText: response.statusText, headers});
        for (const key of ['url', 'redirected', 'type']) Object.defineProperty(result, key, {value: response[key], configurable: true});
        return result;
      } catch { return response; }
    };
  }
  const XHR = globalThis.XMLHttpRequest;
  if (XHR?.prototype) {
    const proto = XHR.prototype;
    const nativeOpen = proto.open;
    const nativeText = Object.getOwnPropertyDescriptor(proto, 'responseText')?.get;
    const nativeResponse = Object.getOwnPropertyDescriptor(proto, 'response')?.get;
    const requests = new WeakMap();
    if (typeof nativeOpen === 'function' && nativeText && nativeResponse) {
      function usable(xhr, record) {
        return enabled && xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300 && record.trusted;
      }
      function count(record) { if (!record.counted) { record.counted = true; state.xhrMatched++; } }
      function textValue(xhr, record, original) {
        if (!usable(xhr, record) || !['', 'text'].includes(xhr.responseType)) return original;
        count(record);
        if (!record.textRead) { record.textRead = true; record.cleanedText = filterText(original); }
        return record.cleanedText === null ? original : record.cleanedText;
      }
      proto.open = function(method, url) {
        const previous = requests.get(this);
        if (previous?.wrapped) {
          try {
            if (Object.getOwnPropertyDescriptor(this, 'responseText')?.get === previous.textGetter) delete this.responseText;
            if (Object.getOwnPropertyDescriptor(this, 'response')?.get === previous.responseGetter) delete this.response;
          } catch { /* Keep protected objects unchanged. */ }
        }
        const result = Reflect.apply(nativeOpen, this, arguments);
        const record = {trusted: playerEndpoint(String(url)), wrapped: false, counted: false,
          textRead: false, jsonRead: false, cleanedText: null};
        requests.set(this, record);
        if (!record.trusted || Object.hasOwn(this, 'response') || Object.hasOwn(this, 'responseText')) return result;
        try {
          const self = this;
          Object.defineProperty(this, 'responseText', {configurable: true, get() {
            return textValue(self, record, nativeText.call(self));
          }});
          record.textGetter = Object.getOwnPropertyDescriptor(this, 'responseText').get;
          Object.defineProperty(this, 'response', {configurable: true, get() {
            const original = nativeResponse.call(self);
            if (!usable(self, record)) return original;
            if (['', 'text'].includes(self.responseType)) return textValue(self, record, original);
            if (self.responseType === 'json' && !record.jsonRead) {
              record.jsonRead = true; count(record); clean(original);
            }
            return original;
          }});
          record.responseGetter = Object.getOwnPropertyDescriptor(this, 'response').get;
          record.wrapped = true;
        } catch {
          try {
            if (record.textGetter && Object.getOwnPropertyDescriptor(this, 'responseText')?.get === record.textGetter) delete this.responseText;
            if (record.responseGetter && Object.getOwnPropertyDescriptor(this, 'response')?.get === record.responseGetter) delete this.response;
          } catch { /* No modification possible. */ }
        }
        return result;
      };
    }
  }
  document.addEventListener('navega-livre-youtube-config', event => {
    if (typeof event.detail?.enabled === 'boolean') enabled = event.detail.enabled;
  });
})();
