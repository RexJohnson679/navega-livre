/* Isolated-world preferences bridge. String detail crosses Firefox compartments
 * without exposing extension APIs, cookies, tokens or other preferences. */
(() => {
  'use strict';
  const C = globalThis.NavegaCore;
  const api = typeof browser !== 'undefined' ? browser : chrome;
  let value = null;
  function publish() {
    if (!value) return;
    document.dispatchEvent(new CustomEvent('navega-livre-youtube-config', {
      detail: JSON.stringify({enabled: C.active(value, location.hostname) && value.youtube})
    }));
  }
  document.addEventListener('navega-livre-youtube-ready', publish);
  api.storage.local.get('config').then(data => { value = C.normalizeConfig(data.config); publish(); }).catch(() => {});
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.config) { value = C.normalizeConfig(changes.config.newValue); publish(); }
  });
})();
