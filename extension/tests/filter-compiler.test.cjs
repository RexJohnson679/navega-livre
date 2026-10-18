const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../scripts/filter-compiler.cjs');
test('network conversion preserves resource types, party and domain constraints',()=>{
  const rule=F.parseNetwork('||ads.example^$script,third-party,domain=reader.test|~vip.reader.test');
  assert.deepEqual(rule.condition,{domainType:'thirdParty',initiatorDomains:['reader.test'],excludedInitiatorDomains:['vip.reader.test'],resourceTypes:['script'],requestDomains:['ads.example']});
  assert.equal(F.parseNetwork('@@||ads.example/player.js$script').action.type,'allow');
  assert.equal(F.parseNetwork('/ads/banner/*$image,~third-party').condition.domainType,'firstParty');
});
test('unsupported syntax cannot become a broader block or access rule',()=>{
  for(const text of ['||example.test^$popup','||example.test^$redirect=noopjs','||example.test^$document','||example.test^$domain=reader.*','/ad[0-9]+/$script','@@||example.test^$generichide'])assert.equal(F.parseNetwork(text),null,text);
  assert.equal(F.parseNetwork('||youtube.com^',['youtube.com']),null);
  assert.ok(!F.parseNetwork('/ads.js').condition.resourceTypes.includes('main_frame'));
});
test('important blocks outrank list exceptions; both remain below explicit site pause',()=>{
  assert.ok(F.parseNetwork('||ads.example^$important').priority>F.parseNetwork('@@||ads.example^').priority);
  assert.ok(F.parseNetwork('||ads.example^$important').priority<100);
});
test('compression keeps constrained and unconstrained domains in separate groups',()=>{
  const out=F.compileNetwork(['||ads-a.example^\n||ads-b.example^\n||ads-c.example^$third-party\n@@||ads-d.example^$domain=reader.test'],1,[]);
  assert.equal(out.accepted,4);assert.equal(out.rules.length,3);
  assert.ok(out.rules.some(r=>r.condition.requestDomains.length===2));
  assert.ok(out.rules.some(r=>r.condition.domainType==='thirdParty'&&r.condition.requestDomains[0]==='ads-c.example'));
});
test('cosmetic exceptions only disable the matched selector in matching host contexts',()=>{
  const out=F.compileCosmetics('##.ad-banner\n###advert\n##body{display:none}\n##.ad-banner','reader.test#@#.ad-banner');
  assert.equal(out.selectorCount,2);assert.equal(out.hosts.length,1);
  assert.deepEqual(out.hosts[0].selectors,['.ad-banner']);assert.ok(out.css.includes('data-navega-livre-cosmetic-exceptions'));
  assert.ok(out.css.includes(':not(main):not(article)'));assert.equal(out.css.includes('body{display:none}'),false);
});
