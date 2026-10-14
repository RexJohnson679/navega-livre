(() => {
  'use strict';
  const C = globalThis.NavegaCore;
  const P = globalThis.NavegaPopupPolicy;
  if (!C) return;
  const HOST = location.hostname.toLowerCase();
  const HIDDEN = 'data-navega-livre-hidden';
  const YT_SELECTORS = [
    'ytd-ad-slot-renderer', 'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-video-renderer',
    'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer',
    'ytd-action-companion-ad-renderer', 'ytd-player-legacy-desktop-watch-ads-renderer',
    '#masthead-ad', '#player-ads', '.ytp-ad-overlay-container'
  ];
  const COMMON_SELECTORS = ['ins.adsbygoogle', '.google-auto-placed',
    '[data-ad-slot][data-ad-client]', '[id^="div-gpt-ad"]',
    '.ad-banner', '.ad-container', '.advertisement', '.adsbox', '.textads',
    '.OUTBRAIN[data-widget-id]', 'ins.pubadx-slot', '.pubadx-offer',
    '.ad-slot', '.ad-unit', '.ad-placement', '.ad-wrapper', '.ad-overlay', '.ad-popup',
    '.ads-banner', '.ads-container', '.adsbyexoclick', '.exo-native-widget', '.adsterra-banner',
    '[data-ad-unit]', '[data-ad-format]', '[data-ad-manager-id]', '[id^="google_ads_iframe"]'];
  const SKIP_SELECTORS = ['.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-skip-ad-button'];
  const GATE_SELECTORS = '[role="dialog"],dialog,[class*="adblock" i],[id*="adblock" i],[class*="anti-adblock" i]';
  const browserApi = typeof browser !== 'undefined' ? browser : chrome;

  let settings = C.normalizeConfig();
  let ready = false, timer = null, pending = null;
  let topHost = HOST, frameReady = !globalThis.top || globalThis.top === globalThis;
  let lastSkip = 0, lastKnown = 0, overflowSaved = null;
  const originalMuted = new Map();
  const hiddenNodes = new Set();
  const inertNodes = new Map();
  const stats = {adsHidden: 0, skipClicks: 0, noticesHidden: 0, knownRepair: false};
  const countedAds = new WeakSet();
  function active() { return frameReady && C.active(settings, HOST) && C.active(settings, topHost); }

  function hide(node, kind) {
    if (!node || node === document.body || node === document.documentElement || node.id === 'root' || node.id === '__next' || node.hasAttribute(HIDDEN)) return;
    node.setAttribute(HIDDEN, kind);
    hiddenNodes.add(node);
    if (kind === 'notice') stats.noticesHidden++;
    else if (!countedAds.has(node)) { countedAds.add(node); stats.adsHidden++; }
  }

  function hideAd(node) {
    hide(node, 'ad');
    // Collapse an otherwise empty floating wrapper, including its close button.
    // Never climb into article, reader, navigation or app containers.
    let child = node;
    for (let depth = 0; depth < 3; depth++) {
      const parent = child?.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement ||
          parent.matches('main,article,nav,header,footer,[role="main"],#root,#__next')) break;
      const onlyAd = [...parent.children].every(sibling => sibling === child || sibling.matches('script,style,link') ||
        (sibling.matches('button,[role="button"]') && /^(?:\s*|[×✕x]|close|fechar)$/i.test(sibling.textContent.trim())));
      if (!onlyAd) break;
      if (getComputedStyle(parent).position === 'fixed') { hide(parent, 'ad'); break; }
      child = parent;
    }
  }

  function unmute() {
    for (const [video, muted] of originalMuted) {
      if (video.isConnected) video.muted = muted;
    }
    originalMuted.clear();
  }

  function undoNotices() {
    for (const node of hiddenNodes) {
      if (node.getAttribute(HIDDEN) === 'notice') { node.removeAttribute(HIDDEN); hiddenNodes.delete(node); }
    }
    for (const [node, old] of inertNodes) {
      if (old.inert === null) node.removeAttribute('inert'); else node.setAttribute('inert', old.inert);
      if (old.aria === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', old.aria);
    }
    inertNodes.clear();
    if (overflowSaved) {
      for (const [node, value, priority] of overflowSaved) {
        if (value) node.style.setProperty('overflow', value, priority); else node.style.removeProperty('overflow');
      }
      overflowSaved = null;
    }
  }

  function undoAll() {
    undoNotices();
    for (const node of hiddenNodes) node.removeAttribute(HIDDEN);
    hiddenNodes.clear();
    unmute();
  }

  function unlockBackground() {
    if (!overflowSaved) {
      overflowSaved = [document.documentElement, document.body].filter(Boolean).map(node =>
        [node, node.style.getPropertyValue('overflow'), node.style.getPropertyPriority('overflow')]);
    }
    for (const [node] of overflowSaved) node.style.setProperty('overflow', 'auto', 'important');
    for (const node of document.querySelectorAll('.adblock-guard-content')) {
      if (!inertNodes.has(node)) inertNodes.set(node, {inert: node.getAttribute('inert'), aria: node.getAttribute('aria-hidden')});
      node.removeAttribute('inert'); node.removeAttribute('aria-hidden');
    }
  }

  function repairNotices() {
    let removed = false;
    for (const node of document.querySelectorAll(GATE_SELECTORS)) {
      if (node === document.body || node === document.documentElement || node.id === 'root' || node.hasAttribute(HIDDEN)) continue;
      const text = node.textContent || '';
      if (text.length > 3000 || !C.adblockText(text)) continue;
      const computed = getComputedStyle(node);
      const overlay = node.matches('[role="dialog"],dialog,.adblock-screen') || computed.position === 'fixed';
      if (!overlay || computed.display === 'none') continue;
      hide(node, 'notice'); removed = true;
    }
    if (removed) unlockBackground();
    if (document.querySelector('.adblock-guard-content') && Date.now() - lastKnown > 5000) {
      lastKnown = Date.now();
      if (browserApi.runtime && browserApi.runtime.sendMessage) {
        browserApi.runtime.sendMessage({type: 'KNOWN_REPAIR'}).then(result => {
          if (result?.repaired) stats.knownRepair = true;
        }).catch(() => {});
      }
    }
  }

  function youtube() {
    for (const selector of YT_SELECTORS) for (const node of document.querySelectorAll(selector)) hide(node, 'ad');
    const player = document.querySelector('#movie_player');
    if (!player || !(player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) { unmute(); return; }
    if (settings.muteAds) {
      for (const video of player.querySelectorAll('video')) {
        if (!originalMuted.has(video)) originalMuted.set(video, video.muted);
        video.muted = true;
      }
    } else unmute();
    if (!settings.skipAds || Date.now() - lastSkip < 1500) return;
    for (const selector of SKIP_SELECTORS) {
      const button = player.querySelector(selector);
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true' || !button.getClientRects().length || getComputedStyle(button).visibility === 'hidden') continue;
      lastSkip = Date.now(); button.click(); stats.skipClicks++; break;
    }
  }

  function scan() {
    pending = null;
    if (!ready || !active() || !document.body) return;
    if (settings.cosmetics) {
      for (const selector of COMMON_SELECTORS) for (const node of document.querySelectorAll(selector)) hideAd(node);
      for (const node of document.querySelectorAll('iframe[src],img[src],a[href],embed[src],object[data]')) try {
        const value = node.getAttribute('src') || node.getAttribute('href') || node.getAttribute('data');
        if (P?.adUrl(value, location.href)) hideAd(node);
      } catch { /* Non-HTTP and invalid frame sources stay untouched. */ }
    }
    if (C.youtubeHost(HOST) && settings.youtube) youtube(); else unmute();
    if (settings.repairHosts.includes(HOST)) repairNotices();
    for (const node of hiddenNodes) if (!node.isConnected) hiddenNodes.delete(node);
    for (const [node] of inertNodes) if (!node.isConnected) inertNodes.delete(node);
  }

  function schedule() {
    if (!pending && ready && active()) pending = setTimeout(scan, 120);
  }

  function setSettings(value) {
    settings = C.normalizeConfig(value); ready = true;
    if (C.youtubeHost(HOST)) document.dispatchEvent(new CustomEvent('navega-livre-youtube-config', {
      detail: JSON.stringify({enabled: active() && settings.youtube})
    }));
    observer.disconnect();
    if (pending) clearTimeout(pending);
    pending = null;
    undoAll();
    if (timer) clearInterval(timer);
    timer = null;
    if (active()) {
      if (document.documentElement) observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'src', 'href', 'id', 'style', 'data-zoneid', 'data-ad-slot', 'data-ad-unit', 'data-ad-client']});
      scan();
      // Ordinary sites are scanned on DOM changes; only player/notice handling needs a heartbeat.
      if ((C.youtubeHost(HOST) && settings.youtube) || settings.repairHosts.includes(HOST)) timer = setInterval(scan, 900);
    }
  }

  const observer = new MutationObserver(schedule);
  document.addEventListener('DOMContentLoaded', () => { if (ready) setSettings(settings); });
  document.addEventListener('yt-navigate-finish', schedule);
  if (!frameReady) browserApi.runtime.sendMessage({type: 'FRAME_CONTEXT'}).then(result => {
    if (!result?.ok || !result.host) return;
    topHost = result.host; frameReady = true;
    if (ready) setSettings(settings);
  }).catch(() => {});

  if (browserApi.storage && browserApi.storage.local) {
    browserApi.storage.local.get('config').then(result => setSettings(result.config)).catch(() => {});
    browserApi.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.config) setSettings(changes.config.newValue);
    });
  }
  if (browserApi.runtime && browserApi.runtime.onMessage) {
    browserApi.runtime.onMessage.addListener((message, sender, respond) => {
      if (message.type === 'PAGE_STATUS') respond({host: HOST, active: active(), ...stats});
      if (message.type === 'REPAIR_NOW') {
        if (message.enabled) { settings.repairHosts = [...new Set([...settings.repairHosts, HOST])]; scan(); }
        else { settings.repairHosts = settings.repairHosts.filter(host => host !== HOST); undoNotices(); }
        respond({...stats});
      }
    });
  }
  addEventListener('pagehide', () => {
    unmute(); observer.disconnect();
    if (pending) clearTimeout(pending);
    if (timer) clearInterval(timer);
    pending = null; timer = null;
  });
  addEventListener('pageshow', event => { if (event.persisted && ready) setSettings(settings); });
})();
