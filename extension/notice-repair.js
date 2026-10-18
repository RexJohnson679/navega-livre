/* Local, opt-in notice repair. No network requests, page-code evaluation or saved DOM. */
(() => {
  'use strict';
  const MARK = 'data-navega-livre-hidden';
  const LIMITS = Object.freeze({sliceNodes: 350, sliceMs: 5, manualNodes: 24000,
    automaticNodes: 6000, scopes: 24, retained: 64, shadowRoots:16, textNodes: 100, textChars: 2800});
  const PROTECTED = 'html,body,main,article,nav,header,footer,form,#root,#__next,[role="main"],video,canvas,iframe';
  const ROOTS = 'html,body,nav,form,#root,#__next,#reader,[role="main"],video,canvas,iframe';
  const PRIMARY = 'main,article,[role="main"],#reader';
  const IGNORE = 'script,style,noscript,template,pre,code,textarea,[contenteditable="true"]';
  const GATES = 'dialog,[role="dialog"],[aria-modal="true"],[class*="adblock" i],[id*="adblock" i],[class*="ad-block" i],[id*="ad-block" i],[class*="modal" i],[class*="overlay" i],[class*="popup" i]';
  const BLOCKER = /ad\s*[- ]?block(?:er)?|bloqueador(?:es)?\s+(?:de\s+)?an[uú]ncios|bloqueo\s+de\s+anuncios|uBlock|AdGuard/i;
  const HINT = /ad\s*[- ]?block|blocker|bloqueador|bloqueo|uBlock|AdGuard/i;
  const COMMAND = /desativ|desabilit|deslig|paus|disable|deactivat|turn\s+off|switch\s+off|whitelist|allowlist|lista\s+de\s+exce[çc]|desactiva/i;
  const DETECTED = /detect(?:ado|ada|amos|ed)|identificamos|est[aá]\s+ativ|is\s+(?:active|enabled)|parece\s+que|looks\s+like|uso\s+de\s+um/i;
  const PAID = /\bVIP\b|premium|assinatura|assine|subscription|subscribe|paywall|fa[çc]a\s+login|sign\s+in|log\s+in/i;
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  function evidence(text) {
    const value = normalize(text).slice(0, LIMITS.textChars);
    const at = value.search(BLOCKER);
    if (at < 0) return false;
    const nearby = value.slice(Math.max(0, at - 140), at + 180);
    return COMMAND.test(nearby) || DETECTED.test(nearby);
  }
  function shortText(node) {
    const doc = node.ownerDocument || document;
    const walk = doc.createTreeWalker(node, 4);
    let text = '', current, count = 0;
    while ((current = walk.nextNode()) && count++ < LIMITS.textNodes) {
      if (current.parentElement?.closest(IGNORE)) continue;
      text += ' ' + String(current.nodeValue || '').slice(0, LIMITS.textChars - text.length + 1);
      if (text.length > LIMITS.textChars) return null;
    }
    return current ? null : normalize(text);
  }
  function visible(node) {
    if (!node?.isConnected || !node.getClientRects().length) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
  }
  function closeControl(node) {
    let count = 0;
    for (const button of node.querySelectorAll('button,[role="button"],input[type="button"]')) {
      if (++count > 32) break;
      const label = normalize(button.getAttribute('aria-label') || button.getAttribute('title') || button.value || button.textContent);
      if (!/^(?:fechar(?: aviso| janela)?|close(?: notice| dialog)?|dismiss|agora n[aã]o|not now|[×✕✖x])$/i.test(label)) continue;
      if (button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('a[href],form') || !visible(button)) continue;
      return button;
    }
    return null;
  }
  function headingEvidence(node) {
    let count = 0;
    for (const heading of node.querySelectorAll('h1,h2,h3,[role="heading"]')) {
      if (++count > 6) break;
      const text = shortText(heading);
      if (text && evidence(text)) return true;
    }
    return false;
  }
  function modalAncestor(node) {
    for (let parent = node.parentElement, depth = 0; parent && depth < 5; parent = parent.parentElement, depth++) {
      if (parent.matches(ROOTS)) break;
      const s = getComputedStyle(parent);
      if (parent.matches('dialog,[role="dialog"],[aria-modal="true"]') || s.position === 'fixed' ||
          (s.position === 'absolute' && Number(s.zIndex) >= 10)) return true;
    }
    return false;
  }
  function simpleFooterNavigation(node, modalContext) {
    let count = 0;
    for (const nav of node.querySelectorAll('nav')) {
      if (++count > 2 || !modalContext || !headingEvidence(node)) return false;
      if (nav !== node.lastElementChild && !nav.closest('footer')) return false;
      if (nav.querySelector('input,select,button,form,[role="menu"]')) return false;
      const text = shortText(nav), links = nav.querySelectorAll('a[href]');
      if (!text || text.length > 300 || links.length > 6 || !links.length) return false;
    }
    return true;
  }
  function inspect(node) {
    const recover = node?.localName === 'dialog' && node.hasAttribute('open') && node.getAttribute(MARK) === 'notice';
    if (!node?.matches || node.matches(ROOTS) || node.closest(IGNORE) || (!recover && !visible(node))) return null;
    // A notice must have a compact, dedicated container; never hide a reader or app shell.
    if (node.querySelector('form,input[type="password"],#reader,[role="main"],video,canvas,iframe')) return null;
    let parts = 0;
    for (const part of node.querySelectorAll('main,article')) {
      if (++parts > 8 || !headingEvidence(part)) return null;
    }
    const style = getComputedStyle(node);
    const modal = node.matches('dialog,[role="dialog"],[aria-modal="true"]');
    const floating = style.position === 'fixed' || (style.position === 'absolute' && Number(style.zIndex) >= 10);
    const semantic = node.matches('main,article,header,footer');
    const shell = headingEvidence(node) && (semantic || (node.querySelector('header') && node.querySelector('footer')));
    const context = shell && (modal || floating || modalAncestor(node) || node.querySelector('dialog,[role="dialog"],[aria-modal="true"]'));
    if (semantic && !context) return null;
    const named = /ad[-_ ]?block|blocker|bloqueador/i.test(node.id + ' ' + node.className);
    if (!modal && !floating && !context && !(named && !node.closest('article,main,[role="main"]'))) return null;
    const text = shortText(node);
    if (!text) return null;
    const known = typeof location === 'object' && /^(?:www\.)?(?:lycantoons\.com|vegitoons\.black)$/.test(location.hostname) &&
      globalThis.NavegaNoticePolicy?.canRepair(node, location.hostname);
    if (!evidence(text) && !known) return null;
    if (!simpleFooterNavigation(node,modal || floating || context)) return null;
    const close = closeControl(node);
    // Mixed donation notices can be dismissed; a subscription or account gate cannot.
    if (PAID.test(text) && !close) return null;
    return {node, close, modal, floating, shell:!!context, recover};
  }
  function candidateFrom(node) {
    let element = node?.nodeType === 1 ? node : node?.parentElement;
    let inline = null;
    for (let depth = 0; element && depth < 8; depth++, element = element.parentElement) {
      if (element.matches(ROOTS)) break;
      const result = inspect(element);
      if (result && (!inline || result.floating || result.modal || result.shell)) inline = result;
      if (element.matches('main,article') && !result) break;
    }
    return inline;
  }

  function create({document: doc = document, onRepair = () => {}} = {}) {
    let enabled = false, timer = null, manual = false, scanned = 0, lastCost = 0, busy = false;
    let queue = [], current = null, waiters = [], inspected = new WeakSet();
    const touched = new Map(), locks = new Map(), shadows = new Set(), clicked = new WeakSet(), ownStyles = new WeakMap();
    let result = {state: 'idle', detected: 0, repaired: 0, unlocked:0, remaining:0, limited: false, visited: 0};
    const metrics = {runs: 0, visited: 0, maxSliceNodes: 0, maxSliceMs: 0, cpuMs: 0};
    const now = () => performance.now();
    function prune() {
      for (const [node] of touched) if (!node.isConnected) touched.delete(node);
      for (const [node] of locks) if (!node.isConnected) locks.delete(node);
      let removed = false;
      for (const root of shadows) if (!root.host.isConnected) { shadows.delete(root); removed = true; }
      if (removed && enabled) {
        observer.disconnect(); observer.observe(doc.documentElement || doc, observation);
        for (const root of shadows) observer.observe(root, observation);
      }
    }
    function hide(node) {
      if (!touched.has(node)) {
        if (touched.size >= LIMITS.retained) return false;
        touched.set(node, {mark: node.getAttribute(MARK), display: node.style.getPropertyValue('display'),
          priority: node.style.getPropertyPriority('display')});
      }
      if (node.getAttribute(MARK) !== 'notice') node.setAttribute(MARK, 'notice');
      if (node.style.getPropertyValue('display') !== 'none' || node.style.getPropertyPriority('display') !== 'important') node.style.setProperty('display', 'none', 'important');
      ownStyles.set(node, node.getAttribute('style'));
      return true;
    }
    function anotherModal(notice) {
      let checked = 0;
      for (const other of doc.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')) {
        if (++checked > 40) return true;
        if (other !== notice && !other.contains(notice) && !notice.contains(other) && visible(other)) return true;
      }
      return false;
    }
    function saveStyle(node, key, value) {
      if (!locks.has(node)) {
        if (locks.size >= 26) { result.limited = true; return false; }
        locks.set(node, {});
      }
      const saved = locks.get(node);
      if (!(key in saved)) saved[key] = [node.style.getPropertyValue(key), node.style.getPropertyPriority(key), value];
      if (node.style.getPropertyValue(key) !== value || node.style.getPropertyPriority(key) !== 'important') {
        node.style.setProperty(key, value, 'important');
        ownStyles.set(node, node.getAttribute('style'));
        return true;
      }
      return false;
    }
    function clearAttribute(node, name) {
      if (!node.hasAttribute(name)) return false;
      if (!locks.has(node)) {
        if (locks.size >= 26) { result.limited = true; return false; }
        locks.set(node, {});
      }
      const saved = locks.get(node), key = '@' + name;
      if (!(key in saved)) saved[key] = node.getAttribute(name);
      node.removeAttribute(name);
      return true;
    }
    function unlock(notice) {
      // Keep the lock if an unrelated visible modal is still open (login, consent, payment, etc.).
      if (anotherModal(notice)) return;
      for (const node of [doc.documentElement, doc.body]) {
        if (!node) continue;
        for (const key of ['overflow', 'overflow-y']) {
          const value = node.style.getPropertyValue(key), computed = getComputedStyle(node);
          if (!/hidden|clip/.test(value || computed[key === 'overflow-y' ? 'overflowY' : 'overflow'])) continue;
          saveStyle(node,key,'auto');
        }
      }
      // Inspect only background branches associated with this notice, including nested app roots.
      const background = new Set();
      function add(node) {
        if (!node || node === doc.body || node === doc.documentElement || background.size >= 26 ||
            node === notice || node.contains(notice) || notice.contains(node) || node.closest('[' + MARK + ']')) return;
        background.add(node);
      }
      let primary = 0;
      for (const region of doc.querySelectorAll(PRIMARY)) {
        if (++primary > 16) break;
        for (let node = region, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
          if (node === doc.body || node === doc.documentElement || node.contains(notice)) break;
          add(node);
        }
      }
      for (let layer = notice, depth = 0; layer?.parentElement && depth < 5; layer = layer.parentElement, depth++) {
        let count = 0;
        for (const sibling of layer.parentElement.children) {
          if (++count > 32) break;
          if (sibling === layer || sibling.matches('nav,form,header,footer,dialog,[role="dialog"]')) continue;
          const s = getComputedStyle(sibling), r = sibling.getBoundingClientRect();
          const largeBlur = /blur\(/i.test(s.filter || '') && r.width >= 240 && r.height >= 160;
          if (sibling.matches(PRIMARY) || sibling.querySelector(PRIMARY) || sibling.hasAttribute('inert') || largeBlur) add(sibling);
        }
      }
      for (const node of background) {
        const s = getComputedStyle(node);
        const locked = node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true' ||
          /blur\(/i.test(s.filter || '') || s.pointerEvents === 'none';
        if (!locked) continue;
        let changed = clearAttribute(node,'inert');
        if (node.getAttribute('aria-hidden') === 'true') changed = clearAttribute(node,'aria-hidden') || changed;
        if (/blur\(/i.test(s.filter || '')) changed = saveStyle(node,'filter',s.filter.replace(/\bblur\([^)]*\)/gi,'').trim() || 'none') || changed;
        if (s.pointerEvents === 'none') changed = saveStyle(node,'pointer-events','auto') || changed;
        if (changed) result.unlocked++;
        const after = getComputedStyle(node);
        if (node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true' || /blur\(/i.test(after.filter || '') ||
            after.pointerEvents === 'none' || after.display === 'none') result.remaining++;
      }
    }
    function backdrops(notice) {
      if (anotherModal(notice)) return;
      const parent = notice.parentElement;
      if (!parent) return;
      let count = 0;
      for (const sibling of parent.children) {
        if (++count > 40) break;
        if (sibling === notice || sibling.matches(PROTECTED) || !visible(sibling)) continue;
        if (!/backdrop|overlay|scrim|mask/i.test(sibling.id + ' ' + sibling.className)) continue;
        if (sibling.querySelector('a,button,input,iframe,main,article,video,canvas') || shortText(sibling)) continue;
        const s = getComputedStyle(sibling), r = sibling.getBoundingClientRect();
        if (['fixed','absolute'].includes(s.position) && r.width >= (doc.defaultView?.innerWidth || 800) * .7 &&
            r.height >= (doc.defaultView?.innerHeight || 600) * .7 && !hide(sibling)) result.limited = true;
      }
    }
    function repair(info) {
      const {node, close} = info;
      if (!info.recover && !visible(node)) return false;
      // A native dialog owns browser modality and ::backdrop, even if its wrapper is hidden.
      const native = [];
      if (node.localName === 'dialog' && node.hasAttribute('open')) native.push(node);
      for (const dialog of node.querySelectorAll('dialog[open]')) {
        if (native.length >= 4) break;
        if (inspect(dialog)) native.push(dialog);
      }
      result.detected++;
      prune();
      if (!touched.has(node) && touched.size >= LIMITS.retained) { result.limited = true; return false; }
      hide(node);
      backdrops(node);
      if (close && !clicked.has(close)) {
        clicked.add(close);
        try { close.click(); } catch { /* Hiding remains useful when a site handler throws. */ }
      }
      for (const dialog of native) if (typeof dialog.close === 'function') {
        try { dialog.close(); } catch { /* The final state below reports an unclosed native layer. */ }
      }
      result.repaired++;
      unlock(node);
      if (native.some(dialog => dialog.hasAttribute('open')) || node.closest('dialog[open]')) result.remaining++;
      onRepair();
      return true;
    }
    function examine(node) {
      if (!node?.matches || inspected.has(node)) return;
      inspected.add(node);
      const found = candidateFrom(node);
      if (found) repair(found);
    }
    function seeds(root) {
      if (root.nodeType === 1) examine(root);
      let count = 0;
      for (const node of root.querySelectorAll?.(GATES) || []) {
        if (++count > 40) break;
        examine(node);
      }
      if (root !== doc) return;
      // A foreground anonymous notice can be found without traversing a large reader.
      const width = doc.defaultView?.innerWidth || 800, height = doc.defaultView?.innerHeight || 600;
      for (const [x,y] of [[.5,.5],[.3,.3],[.7,.3],[.3,.7],[.7,.7]]) {
        let seen = 0;
        for (const node of doc.elementsFromPoint?.(width*x,height*y) || []) {
          if (++seen > 4) break;
          examine(node);
        }
      }
    }
    function enqueue(node) {
      const root = node?.nodeType === 3 ? node.parentElement : node;
      if (!root || ![1,9,11].includes(root.nodeType)) return;
      if (root.nodeType === 1) {
        const marked = root.closest('[' + MARK + ']');
        if (root.closest(IGNORE) || (marked && !visible(marked))) return;
      }
      if (queue.some(other => other === root || other.contains?.(root))) return;
      queue = queue.filter(other => !root.contains?.(other));
      if (queue.length >= LIMITS.scopes) { result.limited = true; return; }
      queue.push(root);
    }
    function finish() {
      if (timer !== null) clearTimeout(timer);
      timer = null; current = null; queue = [];
      result.visited = scanned;
      result.state = result.repaired ? (result.remaining ? 'partial' : 'repaired') : result.limited ? 'limited' : 'not-found';
      prune();
      const saved = {...result};
      for (const resolve of waiters.splice(0)) resolve(saved);
      manual = false;
      inspected = new WeakSet();
    }
    function schedule(delay = 120) {
      if (enabled && timer === null && !doc.hidden) timer = setTimeout(step, delay);
    }
    function step() {
      timer = null;
      if (!enabled || doc.hidden) return;
      const start = now(); let count = 0;
      busy = true;
      try {
        while (count < LIMITS.sliceNodes && now() - start < LIMITS.sliceMs) {
          if (!current) {
            const root = queue.shift();
            if (!root) break;
            seeds(root);
            current = {root, walk: doc.createTreeWalker(root, 5)};
          }
          const node = current.walk.nextNode();
          if (!node) { current = null; continue; }
          count++; scanned++;
          if (node.nodeType === 1) {
            if (node.shadowRoot && (shadows.has(node.shadowRoot) || shadows.size < LIMITS.shadowRoots)) {
              shadows.add(node.shadowRoot);
              enqueue(node.shadowRoot);
              observer.observe(node.shadowRoot, observation);
            }
          } else if (HINT.test(node.nodeValue || '')) examine(node.parentElement);
          if (scanned >= (manual ? LIMITS.manualNodes : LIMITS.automaticNodes)) { result.limited = true; break; }
        }
      } finally {
        busy = false;
        lastCost = now() - start;
        metrics.visited += count; metrics.cpuMs += lastCost;
        metrics.maxSliceNodes = Math.max(metrics.maxSliceNodes, count);
        metrics.maxSliceMs = Math.max(metrics.maxSliceMs, lastCost);
      }
      if (result.limited || (!queue.length && !current)) finish();
      else schedule(15);
    }
    function reset(manualRun) {
      if (timer !== null) clearTimeout(timer);
      timer = null; queue = []; current = null; scanned = 0; manual = manualRun;
      inspected = new WeakSet();
      result = {state:'scanning', detected:0, repaired:0, unlocked:0, remaining:0, limited:false, visited:0};
      metrics.runs++;
    }
    const observation = {childList:true, subtree:true, characterData:true, attributes:true,
      attributeFilter:['class','style','open','hidden','role','aria-modal']};
    const observer = new MutationObserver(records => {
      if (!enabled) return;
      if (doc.hidden) { queue = []; current = null; return; }
      const previous = result.state;
      let count = 0;
      for (const record of records) {
        if (++count > 80) break;
        if (record.type === 'attributes' && record.attributeName === 'open' && record.target.localName === 'dialog' &&
            record.target.hasAttribute('open') && record.target.getAttribute(MARK) === 'notice') {
          if (queue.length < LIMITS.scopes && !queue.includes(record.target)) queue.push(record.target);
          continue;
        }
        if (record.type === 'attributes' && record.attributeName === 'style' &&
            ownStyles.get(record.target) === record.target.getAttribute('style')) continue;
        if (record.type === 'childList') {
          let added = 0;
          for (const node of record.addedNodes) { if (++added > LIMITS.scopes) break; enqueue(node); }
          if (record.target !== doc.body && record.target !== doc.documentElement) enqueue(record.target);
        } else enqueue(record.target);
      }
      if (queue.length && previous !== 'scanning') {
        const scopes = queue;
        reset(false);
        queue = scopes;
      }
      // The extension's own display changes do not keep the repair engine awake.
      if (queue.length && !busy) schedule(Math.min(1200, Math.max(120, lastCost * 16)));
      prune();
    });
    function restore() {
      for (const [node, old] of touched) {
        if (node.getAttribute(MARK) === 'notice') {
          if (old.mark === null) node.removeAttribute(MARK); else node.setAttribute(MARK, old.mark);
        }
        if (node.style.getPropertyValue('display') === 'none' && node.style.getPropertyPriority('display') === 'important') {
          if (old.display) node.style.setProperty('display', old.display, old.priority); else node.style.removeProperty('display');
        }
      }
      touched.clear();
      for (const [node, old] of locks) {
        for (const [key, saved] of Object.entries(old)) {
          if (key.startsWith('@')) {
            const name = key.slice(1);
            if (!node.hasAttribute(name)) node.setAttribute(name,saved);
          } else if (node.style.getPropertyValue(key) === saved[2] && node.style.getPropertyPriority(key) === 'important') {
            const [value, priority] = saved;
            if (value) node.style.setProperty(key, value, priority); else node.style.removeProperty(key);
          }
        }
      }
      locks.clear();
    }
    function start() {
      if (enabled) return;
      enabled = true; observer.observe(doc.documentElement || doc, observation);
      reset(false); enqueue(doc); schedule();
    }
    function run() {
      start();
      reset(true); enqueue(doc);
      const promise = new Promise(resolve => waiters.push(resolve));
      if (doc.hidden) { result.limited = true; finish(); } else schedule(0);
      return promise;
    }
    function stop() {
      enabled = false; observer.disconnect();
      shadows.clear();
      if (timer !== null) clearTimeout(timer);
      timer = null; queue = []; current = null;
      inspected = new WeakSet();
      for (const resolve of waiters.splice(0)) resolve({...result, state:'stopped'});
      restore(); result = {...result, state:'idle'};
    }
    function visibility() {
      if (!enabled) return;
      if (doc.hidden) {
        if (timer !== null) clearTimeout(timer);
        timer = null; queue = []; current = null;
        if (waiters.length) { result.limited = true; finish(); }
      } else { reset(false); enqueue(doc); schedule(); }
    }
    doc.addEventListener('visibilitychange', visibility);
    return {start, run, stop, status:() => ({...result}),
      diagnostics:() => ({...metrics, enabled, queued:queue.length + Number(Boolean(current)),
        retained:touched.size, locks:locks.size, shadowRoots:shadows.size, timer:timer !== null, limits:LIMITS})};
  }
  const api = {create, inspect, evidence, candidateFrom, LIMITS};
  globalThis.NavegaNoticeRepair = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
