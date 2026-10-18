/* Preferences cross the Firefox MAIN boundary only as small JSON strings. */
(() => {
  'use strict';
  const C = globalThis.NavegaCore;
  const api = typeof browser !== 'undefined' ? browser : chrome;
  let settings = C.normalizeConfig(), ready = false, topHost = location.hostname;
  let frameReady = typeof window === 'object' ? window.top === window : globalThis.top === globalThis;
  function send() {
    if (!ready || !frameReady) return;
    document.dispatchEvent(new CustomEvent('navega-livre-popup-config', {detail: JSON.stringify({
      enabled: settings.popups && C.active(settings, location.hostname) && C.active(settings, topHost)
    })}));
  }
  document.addEventListener('navega-livre-popup-ready', send);
  api.storage.local.get('config').then(data => { settings = C.normalizeConfig(data.config); ready = true; send(); }).catch(() => {});
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.config) { settings = C.normalizeConfig(changes.config.newValue); ready = true; send(); }
  });
  if (!frameReady) C.frameContext(api).then(host => {
    if (host) { topHost = host; frameReady = true; send(); }
  });
})();
