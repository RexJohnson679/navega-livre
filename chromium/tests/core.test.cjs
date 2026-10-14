const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../common.js');
test('hostnames and settings discard invalid data', () => {
  assert.equal(C.normalizeHost('https://WWW.YOUTUBE.COM/watch?v=123'), 'www.youtube.com');
  assert.equal(C.normalizeHost('chrome://extensions'), '');
  const settings = C.normalizeConfig({enabled: 'false', youtube: false, disabledHosts: ['Example.COM', 'https://example.com/path', 'chrome://settings']});
  assert.equal(settings.enabled, true); assert.equal(settings.youtube, false);
  assert.deepEqual(settings.disabledHosts, ['example.com']);
  assert.equal(C.normalizeConfig(null).enabled, true);
});
test('site pause matches exact hostname and never changes global setting', () => {
  const settings = C.normalizeConfig({disabledHosts: ['example.com']});
  assert.equal(C.active(settings, 'example.com'), false);
  assert.equal(C.active(settings, 'other.example.com'), true);
  assert.equal(C.active({...settings, enabled: false}, 'youtube.com'), false);
});
test('network allow rules do not match lookalike domains', () => {
  const [rule] = C.allowRules(C.normalizeConfig({disabledHosts: ['example.com']}));
  const re = new RegExp(rule.condition.regexFilter);
  assert.equal(re.test('https://example.com/'), true);
  assert.equal(re.test('http://example.com:8080/watch'), true);
  assert.equal(re.test('https://example.com.evil.test/'), false);
  assert.equal(re.test('https://other.example.com/'), false);
  assert.equal(re.test('https://notexample.com/'), false);
  assert.equal(rule.action.type, 'allowAllRequests');
});
test('cosmetic repair only recognizes advertising-blocker messages', () => {
  assert.equal(C.adblockText('Desative o bloqueador de anúncios para continuar.'), true);
  assert.equal(C.adblockText('Please disable your ad blocker.'), true);
  assert.equal(C.adblockText('Adblock detected. Please try again.'), true);
  for (const text of ['Faça login para continuar', 'Assinatura VIP necessária', 'Subscribe to continue', 'Disable your ad blocker and subscribe', 'Use o código para continuar']) assert.equal(C.adblockText(text), false);
});
test('YouTube scope is not spoofable by a lookalike domain', () => {
  assert.equal(C.youtubeHost('www.youtube.com'), true);
  assert.equal(C.youtubeHost('youtube.com.evil.test'), false);
  assert.equal(C.youtubeHost('notyoutube.com'), false);
});
