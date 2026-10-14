/* Preferences cross the Firefox MAIN boundary only as small JSON strings. */
(() => {
  'use strict';
  const C = globalThis.NavegaCore;
  const api = typeof browser !== 'undefined' ? browser : chrome;
  let settings = C.normalizeConfig(), ready = false, topHost = location.hostname;
  let frameReady = globalThis.top === globalThis;
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
  if (!frameReady) api.runtime.sendMessage({type: 'FRAME_CONTEXT'}).then(result => {
    if (result?.ok && result.host) { topHost = result.host; frameReady = true; send(); }
  }).catch(() => {});
})();
