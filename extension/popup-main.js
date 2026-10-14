/* Runs early in MAIN. No extension API, remote code or tab-closing messages. */
(() => {
  'use strict';
  const P = globalThis.NavegaPopupPolicy;
  const W = typeof window === 'object' ? window : globalThis;
  if (!P || typeof W.__navegaLivrePopupState === 'function') return;
  const VERSION = '0.4.0';
  let enabled = W.top === W;
  let gesture = null;
  const counters = {popupsBlocked: 0, linksBlocked: 0, dialogsBlocked: 0};
  const adFrame = P.adUrl(location.href);
  const nativeOpen = W.open;
  const now = () => performance.now();
  const realElement = node => node && node.nodeType === 1;
  function clickedElement(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    for (const node of path) {
      if (!realElement(node)) continue;
      const anchor = node.closest?.('a[href],area[href]');
      if (anchor) return {href: anchor.getAttribute('href'), button: false, element: anchor};
      if (node.closest?.('button,[role="button"],input[type="button"],input[type="submit"],input[type="image"]')) return {href: null, button: true};
    }
    return {href: null, button: false};
  }
  function deceptiveOverlay(anchor) {
    if (!anchor?.getBoundingClientRect || (anchor.textContent || '').trim() ||
        anchor.querySelector('img,picture,video,svg,canvas,input,button')) return false;
    try {
      const destination = new URL(anchor.getAttribute('href'), location.href);
      if (!/^https?:$/.test(destination.protocol) || destination.origin === new URL(location.href).origin) return false;
      const style = getComputedStyle(anchor), box = anchor.getBoundingClientRect();
      const transparent = Number(style.opacity) <= 0.05 || style.backgroundColor === 'rgba(0, 0, 0, 0)';
      return ['fixed', 'absolute'].includes(style.position) && Number(style.zIndex) >= 1000 && transparent &&
        box.width >= innerWidth * 0.9 && box.height >= innerHeight * 0.9;
    } catch { return false; }
  }
  function record(event) {
    if (!event.isTrusted) { gesture = null; return; }
    gesture = {...clickedElement(event), trusted: true, time: now()};
    if (enabled && gesture.href && (P.adUrl(gesture.href, location.href) || deceptiveOverlay(gesture.element))) {
      event.preventDefault(); event.stopImmediatePropagation();
      counters.linksBlocked++;
      gesture = null;
    }
    // Keep the gesture through native capture/bubble listeners. A microtask may
    // run between those callbacks in a real browser and would reject normal buttons.
    setTimeout(() => { gesture = null; }, 0);
  }
  for (const type of ['pointerdown', 'mousedown', 'touchend', 'click', 'auxclick']) {
    addEventListener(type, record, {capture: true, passive: false});
  }
  if (typeof nativeOpen === 'function') W.open = function(...args) {
    const blocked = P.shouldBlockOpen(args[0], args[1], {
      enabled, base: location.href, adFrame, gesture,
      fresh: Boolean(gesture && now() - gesture.time < 700 && navigator.userActivation?.isActive !== false)
    });
    if (blocked) { counters.popupsBlocked++; return null; }
    return Reflect.apply(nativeOpen, W, args);
  };
  for (const name of ['alert', 'confirm', 'prompt']) {
    const native = W[name];
    if (typeof native !== 'function') continue;
    W[name] = function(...args) {
      if (enabled && P.installBait(args[0])) {
        counters.dialogsBlocked++;
        return name === 'confirm' ? false : name === 'prompt' ? null : undefined;
      }
      return Reflect.apply(native, W, args);
    };
  }
  document.addEventListener('navega-livre-popup-config', event => {
    if (typeof event.detail !== 'string' || event.detail.length > 160) return;
    try {
      const value = JSON.parse(event.detail);
      if (typeof value.enabled === 'boolean') enabled = value.enabled;
    } catch { /* Untrusted page event. */ }
  });
  // Values are copied. No URL, clicked text, form value or browsing history is exposed.
  Object.defineProperty(W, '__navegaLivrePopupState', {configurable: true,
    value: () => ({installed: true, version: VERSION, enabled, ...counters})});
  document.dispatchEvent(new Event('navega-livre-popup-ready'));
})();
