/* Experimental, advertising-only JSON cleanup. Runs in the page world.
 * No account, authorization, media URL, signature or subscription changes.
 */
(() => {
  'use strict';
  if (globalThis.__navegaLivreYoutubeInstalled) return;
  globalThis.__navegaLivreYoutubeInstalled = true;
  let enabled = true;
  const AD_KEYS = new Set(['playerAds', 'adPlacements', 'adSlots']);
  function clean(value) {
    let removed = 0, budget = 15000;
    const visited = new WeakSet();
    function visit(object, depth) {
      if (!object || typeof object !== 'object' || depth > 12 || --budget < 0 || visited.has(object)) return;
      visited.add(object);
      for (const key of Object.keys(object)) {
        if (AD_KEYS.has(key)) {
          try { if (delete object[key]) removed++; } catch { /* Non-configurable field. */ }
        } else visit(object[key], depth + 1);
      }
    }
    visit(value, 0);
    return removed;
  }
  function filterText(text) {
    const prefix = text.match(/^\)\]\}\'(?:\r?\n)?/)?.[0] || '';
    try {
      const value = JSON.parse(text.slice(prefix.length));
      return clean(value) ? prefix + JSON.stringify(value) : null;
    } catch { return null; }
  }
  function playerEndpoint(input) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
      return url.origin === location.origin && /^\/youtubei\/v1\/(?:player|next|reel\/reel_watch_sequence)\/?$/.test(url.pathname);
    } catch { return false; }
  }
  // Catch initial player metadata before the player reads advertising fields.
  for (const key of ['ytInitialPlayerResponse', 'ytInitialData']) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
      if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) continue;
      let value = globalThis[key];
      if (enabled) clean(value);
      Object.defineProperty(globalThis, key, {
        configurable: true, enumerable: true,
        get() { return value; },
        set(next) { value = next; if (enabled) clean(value); }
      });
    } catch { /* Leave protected properties alone. */ }
  }
  if (typeof globalThis.fetch === 'function') {
    const original = globalThis.fetch;
    globalThis.fetch = async function(input, options) {
      const response = await Reflect.apply(original, this, arguments);
      if (!enabled || !response.ok || !playerEndpoint(input)) return response;
      try {
        const text = await response.clone().text();
        if (!enabled) return response;
        const cleaned = filterText(text);
        if (cleaned === null) return response;
        const headers = new Headers(response.headers);
        headers.delete('content-length'); headers.delete('content-encoding');
        const result = new Response(cleaned, {status: response.status, statusText: response.statusText, headers});
        for (const key of ['url', 'redirected', 'type']) {
          Object.defineProperty(result, key, {value: response[key], configurable: true});
        }
        return result;
      } catch { return response; }
    };
  }
  document.addEventListener('navega-livre-youtube-config', event => {
    if (typeof event.detail?.enabled === 'boolean') enabled = event.detail.enabled;
  });
})();
