/* Shared, local-only configuration. Engine core and utilities for Navega Livre. */
(() => {
  'use strict';
  const DEFAULTS = {
    enabled: true, youtube: true, skipAds: true, muteAds: false,
    disabledHosts: [], repairHosts: []
  };
  const AD_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'adservice.google.com', 'adsystem.amazon.com', 'adsrvr.org',
    'adform.net', 'criteo.com', 'criteo.net', 'taboola.com',
    'outbrain.com', 'popads.net', 'popcash.net', 'propellerads.com',
    'adsterra.com', 'bauval.org'
  ];
  function normalizeHost(value) {
    if (typeof value !== 'string') return '';
    try {
      const url = new URL(value.includes('://') ? value : 'https://' + value);
      return /^https?:$/.test(url.protocol) ? url.hostname.toLowerCase().replace(/\.$/, '') : '';
    } catch { return ''; }
  }
  function hosts(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(normalizeHost).filter(Boolean))].sort();
  }
  function normalizeConfig(raw = {}) {
    if (!raw || typeof raw !== 'object') raw = {};
    const result = {...DEFAULTS};
    for (const key of ['enabled', 'youtube', 'skipAds', 'muteAds']) {
      if (typeof raw[key] === 'boolean') result[key] = raw[key];
    }
    result.disabledHosts = hosts(raw.disabledHosts);
    result.repairHosts = hosts(raw.repairHosts);
    return result;
  }
  function active(config, hostname) {
    return config.enabled && !config.disabledHosts.includes(normalizeHost(hostname));
  }
  function youtubeHost(hostname) {
    const host = normalizeHost(hostname);
    return host === 'youtube.com' || host.endsWith('.youtube.com');
  }
  function allowRules(config) {
    return config.disabledHosts.map((host, index) => ({
      id: 1000 + index, priority: 100, action: {type: 'allowAllRequests'},
      condition: {
        regexFilter: '^https?://' + host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?::[0-9]+)?(?:/|$)',
        resourceTypes: ['main_frame', 'sub_frame']
      }
    }));
  }
  function adblockText(text) {
    const value = String(text || '').replace(/\s+/g, ' ').slice(0, 3000);
    if (/assinatura|\bvip\b|premium|sign in|log in|faça login|faca login|subscription|subscribe|paywall/i.test(value)) return false;
    return /(?:desativ|deslig|remov|paus|disable|turn off|deactivate)[\s\S]{0,85}(?:bloqueador|ad\s*block|adblock)|(?:ad\s*block|adblock|bloqueador)[\s\S]{0,65}(?:detectado|detected|ativado|enabled)/i.test(value);
  }
  const core = {DEFAULTS, AD_DOMAINS, normalizeHost, normalizeConfig, active, youtubeHost, allowRules, adblockText};
  globalThis.NavegaCore = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
})();
