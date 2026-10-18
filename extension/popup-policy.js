/* Pure local policy, shared by both browsers, the page guard and cosmetics. */
(() => {
  'use strict';
  const data = globalThis.NavegaBlockingData ||
    (typeof require === 'function' ? require('./filter-data.js') : {advertising: []});
  const advertising = new Set(data.advertising);
  function url(value, base) {
    try { return new URL(value, base); } catch { return null; }
  }
  function adUrl(value, base) {
    const parsed = url(value, base);
    if (!parsed || !/^https?:$/.test(parsed.protocol)) return false;
    let host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    while (host.includes('.')) {
      if (advertising.has(host)) return true;
      host = host.slice(host.indexOf('.') + 1);
    }
    return false;
  }
  function key(parsed) { return parsed.origin + parsed.pathname + parsed.search; }
  // href="#", href="" and javascript: links only run script: they are controls, not destinations.
  function navigating(value) {
    const text = String(value ?? '').trim();
    return text !== '' && !text.startsWith('#') && !/^javascript:/i.test(text);
  }
  function shouldBlockOpen(value, target, context) {
    if (!context.enabled) return false;
    if (adUrl(value, context.base) || context.adFrame) return true;
    // A regular same-tab navigation is not a popup. Known ad URLs were checked above.
    if (['_self', '_top', '_parent'].includes(String(target || '').toLowerCase())) return false;
    const destination = url(value || 'about:blank', context.base);
    const gesture = context.gesture;
    if (!gesture?.trusted || !context.fresh) return true;
    if (navigating(gesture.href)) {
      const expected = url(gesture.href, context.base);
      // An ad listener must not open a different destination over a real link click.
      return !destination || !expected || key(destination) !== key(expected);
    }
    // Buttons, custom controls and script-only links may open share, authentication,
    // download and print windows. A click on plain page area may not.
    return !(gesture.button || (gesture.href !== null && gesture.href !== undefined));
  }
  function installBait(text) {
    const value = String(text || '').replace(/\s+/g, ' ').slice(0, 1500);
    return /(?:instal(?:e|ar|l)|install|download|baixe|atualiz(?:e|ar)|update)[\s\S]{0,100}(?:ad\s*block(?:er)?|bloqueador\s+de\s+an[uú]ncios)/i.test(value) &&
      /desbloque|unlock|continu(?:e|ar)|premium|required|necess[aá]rio|obrigat[oó]ri/i.test(value);
  }
  const policy = Object.freeze({adUrl, shouldBlockOpen, installBait, navigating});
  globalThis.NavegaPopupPolicy = policy;
  if (typeof module !== 'undefined' && module.exports) module.exports = policy;
})();
