(() => {
  'use strict';
  const C = globalThis.NavegaCore;
  const P = globalThis.NavegaPopupPolicy;
  const N = globalThis.NavegaNoticePolicy;
  const R = globalThis.NavegaNoticeRepair;
  const cosmeticData = globalThis.NavegaCosmeticData || {exceptions:[]};
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
    '[data-ad-unit]', '[data-ad-format]', '[data-ad-manager-id]', '[id^="google_ads_iframe"]',
    '.adbox', '.banner_ads', '.banner-ads', '.banner-ads-brilho', '.ad-interstitial', '.ads-overlay',
    '[data-adsense--interstitial-vignette-zone]', '[data-adsense--interstitial-vignette-zone-value]'];
  const SKIP_SELECTORS = ['.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-skip-ad-button'];
  const GATE_SELECTORS = '[role="dialog"],dialog,[class*="adblock" i],[id*="adblock" i],[class*="anti-adblock" i]';
  const browserApi = typeof browser !== 'undefined' ? browser : chrome;

  let settings = C.normalizeConfig();
  let ready = false, timer = null, pending = null;
  let topHost = HOST, frameReady = typeof window === 'object' ? window.top === window : !globalThis.top || globalThis.top === globalThis;
  let lastSkip = 0, lastKnown = 0, overflowSaved = null;
  const originalMuted = new Map();
  const hiddenNodes = new Set();
  const shadowStyles = new Map(), shadowRoots = new Set();
  const exceptionEntries = cosmeticData.exceptions.filter(e=>HOST===e.host||HOST.endsWith('.'+e.host));
  const excludedSelectors = new Set(exceptionEntries.flatMap(e=>e.selectors));
  const inertNodes = new Map();
  const stats = {adsHidden: 0, skipClicks: 0, noticesHidden: 0, knownRepair: false};
  const countedAds = new WeakSet();
  const repairController = R?.create({onRepair: () => stats.noticesHidden++});
  // Last URL examined per node: unchanged links, images and frames are not re-parsed on every scan.
  let urlChecked = new WeakMap();
  let scanCost = 0, lastScanEnd = 0, lastDiscovery = 0, discoveryTimer = null;
  function active() { return frameReady && C.active(settings, HOST) && C.active(settings, topHost); }
  function repairEnabled() { return settings.repairHosts.includes(HOST) || settings.repairHosts.includes(topHost); }

  function hide(node, kind) {
    if (!node || node === document.body || node === document.documentElement || node.id === 'root' || node.id === '__next' || node.hasAttribute(HIDDEN)) return;
    node.setAttribute(HIDDEN, kind);
    if(node.getRootNode?.().nodeType===11) {
      if(!shadowStyles.has(node))shadowStyles.set(node,[node.style.getPropertyValue('display'),node.style.getPropertyPriority('display')]);
      node.style.setProperty('display','none','important');
    }
    hiddenNodes.add(node);
    if (kind === 'notice') stats.noticesHidden++;
    else if (!countedAds.has(node)) { countedAds.add(node); stats.adsHidden++; }
  }

  function hideAd(node) {
    hide(node, 'ad');
    if (!node?.hasAttribute(HIDDEN)) return;
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
    repairController?.stop();
    for (const node of hiddenNodes) {
      if (node.getAttribute(HIDDEN) === 'notice') { node.removeAttribute(HIDDEN); hiddenNodes.delete(node); }
    }
    restoreShadowStyles('notice');
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
    restoreShadowStyles();
    unmute();
    urlChecked = new WeakMap();
  }

  function restoreShadowStyles(kind) {
    for(const [node,[value,priority]] of shadowStyles) {
      if(kind && node.getAttribute(HIDDEN)==='ad')continue;
      if(value)node.style.setProperty('display',value,priority);else node.style.removeProperty('display');
      shadowStyles.delete(node);
    }
  }
  function roots() {
    // Open shadow roots have separate mutation and CSS boundaries. Bound the
    // discovery walk and never intercept attachShadow or touch closed roots.
    // The full-document walk runs at most every 1.5 s; a follow-up scan is queued
    // so a root attached in between is still found.
    const elapsed = Date.now() - lastDiscovery;
    if (elapsed >= 1500) {
      lastDiscovery = Date.now();
      for(const base of [document,...shadowRoots]) {
        let inspected=0;
        for(const node of base.querySelectorAll('*')) {if(inspected++>=1800)break;if(node.shadowRoot && shadowRoots.size<20) {
          shadowRoots.add(node.shadowRoot);
        }}
      }
    } else if (!discoveryTimer) {
      discoveryTimer = setTimeout(() => { discoveryTimer = null; schedule(); }, 1500 - elapsed + 20);
    }
    for(const root of shadowRoots) {
      if(!root.host.isConnected)shadowRoots.delete(root);
      else observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','src','href','id','style']});
    }
    return [document,...shadowRoots];
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

  function repairNotices(root=document) {
    // The production controller handles generic notices independently of cosmetic scans.
    // Older installations with a missing helper retain the conservative legacy path.
    if (!repairController) {
      let removed = false;
      const candidates = N ? N.noticeCandidates(root,HOST) : root.querySelectorAll(GATE_SELECTORS);
      for (const node of candidates) {
        if (!node.hasAttribute(HIDDEN) && (N ? N.canRepair(node,HOST) : C.adblockText(node.textContent))) {
          const close = N?.dismissControl(node);
          hide(node,'notice'); close?.click(); removed = true;
        }
      }
      if (removed) unlockBackground();
    }
    if (document.querySelector('.adblock-guard-content') && Date.now() - lastKnown > 5000) {
      lastKnown = Date.now();
      if (browserApi.runtime && browserApi.runtime.sendMessage) {
        browserApi.runtime.sendMessage({type: 'KNOWN_REPAIR'}).then(result => {
          if (result?.repaired) {stats.knownRepair = true;unlockBackground();}
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

  // One combined selector list means a single pass over the document instead of one pass
  // per selector. If the engine rejects the combined list, fall back to one query each.
  const activeCommon = COMMON_SELECTORS.filter(selector => !excludedSelectors.has(selector));
  const combinedCommon = activeCommon.join(',');
  let combinedOk = true;
  try { document.createDocumentFragment().querySelector(combinedCommon); } catch { combinedOk = false; }
  function commonMatches(root) {
    if (!activeCommon.length) return [];
    if (combinedOk) return root.querySelectorAll(combinedCommon);
    return activeCommon.flatMap(selector => { try { return [...root.querySelectorAll(selector)]; } catch { return []; } });
  }

  function scan() {
    pending = null;
    if (!ready || !active() || !document.body) return;
    const started = performance.now();
    try { scanNow(); }
    finally { lastScanEnd = performance.now(); scanCost = scanCost * 0.5 + (lastScanEnd - started) * 0.5; }
  }

  function scanNow() {
    const scanRoots=roots();
    if (settings.cosmetics) for(const root of scanRoots) {
      for (const node of commonMatches(root)) hideAd(node);
      for (const node of root.querySelectorAll('iframe[src],img[src],a[href],embed[src],object[data]')) try {
        const value = node.getAttribute('src') || node.getAttribute('href') || node.getAttribute('data');
        if (urlChecked.get(node) === value) continue;
        urlChecked.set(node, value);
        if (P?.adUrl(value, location.href)) hideAd(node);
      } catch { /* Non-HTTP and invalid frame sources stay untouched. */ }
      if(N)for(const node of N.advertisingDialogs(root))hideAd(node);
    }
    if (C.youtubeHost(HOST) && settings.youtube) youtube(); else unmute();
    if (repairEnabled()) for(const root of scanRoots)repairNotices(root);
    for (const node of hiddenNodes) if (!node.isConnected) hiddenNodes.delete(node);
    for (const [node] of inertNodes) if (!node.isConnected) inertNodes.delete(node);
  }

  function schedule() {
    // Pages that mutate constantly get proportionally longer gaps instead of a rescan every 120 ms.
    // After a quiet second the next scan stays fast (120 ms); during continuous mutation it backs off.
    if (!pending && ready && active()) {
      const quiet = performance.now() - lastScanEnd > 1000;
      pending = setTimeout(scan, quiet ? 120 : Math.min(2000, Math.max(250, Math.round(scanCost * 12))));
    }
  }

  function setSettings(value) {
    settings = C.normalizeConfig(value); ready = true;
    if (C.youtubeHost(HOST)) document.dispatchEvent(new CustomEvent('navega-livre-youtube-config', {
      detail: JSON.stringify({enabled: active() && settings.youtube})
    }));
    observer.disconnect();
    if (pending) clearTimeout(pending);
    pending = null;
    lastDiscovery = 0;
    undoAll();
    document.documentElement?.setAttribute('data-navega-livre-cosmetics',active()&&settings.cosmetics?'on':'off');
    document.documentElement?.setAttribute('data-navega-livre-cosmetic-exceptions',exceptionEntries.flatMap(e=>e.ids).join(' '));
    if (timer) clearInterval(timer);
    timer = null;
    if (active()) {
      if (document.documentElement) observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'src', 'href', 'id', 'style', 'data-zoneid', 'data-ad-slot', 'data-ad-unit', 'data-ad-client']});
      scan();
      if (repairEnabled()) repairController?.start();
      // Generic repair has no heartbeat: it reacts only to page changes.
      if ((C.youtubeHost(HOST) && settings.youtube) || (!repairController && repairEnabled())) timer = setInterval(scan, 900);
    }
  }

  const observer = new MutationObserver(schedule);
  document.addEventListener('DOMContentLoaded', () => { if (ready) setSettings(settings); });
  document.addEventListener('yt-navigate-finish', schedule);
  if (!frameReady) C.frameContext(browserApi).then(host => {
    if (!host) return;
    topHost = host; frameReady = true;
    if (ready) setSettings(settings);
  });

  if (browserApi.storage && browserApi.storage.local) {
    browserApi.storage.local.get('config').then(result => setSettings(result.config)).catch(() => {});
    browserApi.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.config) setSettings(changes.config.newValue);
    });
  }
  if (browserApi.runtime && browserApi.runtime.onMessage) {
    browserApi.runtime.onMessage.addListener((message, sender, respond) => {
      if (message.type === 'PAGE_STATUS') respond({host: HOST, active: active(), ...stats, repair:repairController?.status()});
      if (message.type === 'REPAIR_NOW') {
        if (message.enabled && active()) {
          settings.repairHosts = [...new Set([...settings.repairHosts, HOST])];
          scan();
          if (repairController) {
            repairController.run().then(repair => respond({...stats, repair})).catch(() => respond({...stats, repair:{state:'error'}}));
            return true;
          }
        }
        else { settings.repairHosts = settings.repairHosts.filter(host => host !== HOST); undoNotices(); }
        respond({...stats});
      }
    });
  }
  addEventListener('pagehide', () => {
    repairController?.stop();
    unmute(); observer.disconnect();
    if (pending) clearTimeout(pending);
    if (timer) clearInterval(timer);
    if (discoveryTimer) clearTimeout(discoveryTimer);
    pending = null; timer = null; discoveryTimer = null;
  });
  addEventListener('pageshow', event => { if (event.persisted && ready) setSettings(settings); });
})();
