const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const vm=require('node:vm');
const C=require('../common.js');
const root=path.resolve(__dirname,'..');
const ads=JSON.parse(fs.readFileSync(path.join(root,'rules/advertising.json')));
const privacy=JSON.parse(fs.readFileSync(path.join(root,'rules/privacy.json')));
const extended=JSON.parse(fs.readFileSync(path.join(root,'rules/privacy-extended.json')));
const model=require('./dnr-model.cjs');
const blocked=(url,initiator,type='script',rules=ads)=>model.blocked(url,initiator,type,rules);
test('broad ad networks and trackers are covered, while video hosts and lookalikes remain available',()=>{
  const page='https://news.example/article';
  for(const host of ['pagead2.googlesyndication.com','securepubads.g.doubleclick.net','ads.pubmatic.com','ib.adnxs.com','ads.taboola.com','cdn.bidswitch.net','adform.net','platform.pubadx.one','ppo.diveinthebluesky.biz','pa.diffgremio.com','acscdn.com']){
    assert.equal(blocked('https://'+host+'/ad.js',page),true,host);
  }
  for(const host of ['www.google-analytics.com','cdn.segment.com','bat.bing.com','static.hotjar.com','cdn.heapanalytics.com','www.googletagmanager.com']){
    assert.equal(blocked('https://'+host+'/tracker.js',page,'script',privacy),true,host);
  }
  for(const url of ['https://rr1.googlevideo.com/videoplayback','https://www.youtube.com/youtubei/v1/player','https://youtubei.googleapis.com/youtubei/v1/player','https://i.ytimg.com/thumbnail.jpg','https://doubleclick.net.example.test/normal.js','https://cdn.jsdelivr.net/lib.js']){
    assert.equal(blocked(url,page,'xmlhttprequest',[...ads,...privacy,...extended]),false,url);
  }
});
test('actual advertising script paths are blocked without intercepting normal scripts or main navigation',()=>{
  const page='https://page.example/';
  for(const url of ['https://page.example/pagead.js','https://page.example/js/adsbygoogle.js?test=1','https://page.example/widget/ads.js'])assert.equal(blocked(url,page),true);
  assert.equal(blocked('https://page.example/app.js',page),false);
  assert.equal(blocked('https://page.example/api/pagead.json',page,'xmlhttprequest'),false);
  assert.equal(blocked('https://doubleclick.net/landing',page,'main_frame'),false);
  assert.equal(blocked('https://doubleclick.net/ad.js','https://doubleclick.net/'),false);
});
test('static rule structure and summary agree and contain no unrestricted media/CDN root',()=>{
  const hosts=new Set([...ads,...privacy,...extended].flatMap(r=>r.condition.requestDomains||[]));
  assert.equal(hosts.size,C.FILTER_INFO.totalDomains);assert.ok(hosts.size>3000);
  for(const root of ['google.com','youtube.com','googlevideo.com','googleapis.com','gstatic.com','ytimg.com','cloudfront.net','cloudflare.com','jsdelivr.net'])assert.equal(hosts.has(root),false);
  for(const rules of [ads,privacy,extended]){
    assert.equal(new Set(rules.map(r=>r.id)).size,rules.length);
    for(const rule of rules){assert.ok(['block','allow'].includes(rule.action.type));assert.ok(!rule.condition.resourceTypes.includes('main_frame'));if(rule.condition.requestDomains)assert.ok(rule.condition.requestDomains.length<=400);}
  }
});
test('both reproducible builds declare network permissions, early preferences and correct browser background',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'navega-build-'));
  try{
    for(const target of ['chromium','firefox']){
      const out=path.join(temp,target);execFileSync(process.execPath,[path.join(root,'scripts/build.cjs'),target,out]);
      const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
      assert.equal(manifest.version,require('../package.json').version);assert.ok(manifest.permissions.includes('declarativeNetRequest'));
      assert.ok(manifest.permissions.includes('webNavigation'));
      assert.deepEqual(manifest.declarative_net_request.rule_resources.map(r=>r.id),['advertising','privacy','privacyExtended']);
      assert.equal(manifest.content_scripts[0].run_at,'document_start');assert.ok(manifest.content_scripts[0].js.includes('youtube-bridge.js'));
      assert.equal(manifest.content_scripts[1].all_frames,true);
      assert.equal(manifest.content_scripts[1].run_at,'document_start');assert.ok(manifest.content_scripts[1].js.includes('popup-bridge.js'));
      assert.ok(manifest.content_scripts[1].js.includes('notice-repair.js'));
      for(const name of ['filter-data.js','popup-policy.js','popup-main.js','popup-main-bundle.js'])assert.ok(fs.existsSync(path.join(out,name)));
      // The production MAIN entry must work without helpers injected by the
      // isolated content script, including Firefox's separate execution global.
      const page={open:()=>({closed:false})};page.top=page;
      const main=vm.createContext({window:page,URL,location:{href:'https://reader.example/'},
        performance:{now:()=>0},navigator:{userActivation:{isActive:true}},setTimeout(){},addEventListener(){},
        document:{addEventListener(){},dispatchEvent(){}},Event:class{}});
      vm.runInContext(fs.readFileSync(path.join(out,'popup-main-bundle.js'),'utf8'),main);
      assert.equal(page.__navegaLivrePopupState().installed,true);
      assert.equal(page.open('https://unknown-ad.example/'),null);
      assert.equal(main.NavegaPopupPolicy.adUrl('https://demand.pubadx.one/click'),true);
      assert.equal(main.NavegaPopupPolicy.adUrl('https://pubadx.one.example/'),false);
      assert.equal(main.NavegaBlockingData.advertising.length,C.FILTER_INFO.advertisingDomains);
      assert.deepEqual(manifest.content_scripts[1].css,['cosmetic.css','cosmetic-filters.css']);assert.ok(fs.existsSync(path.join(out,'cosmetic.css')));
      assert.equal(fs.readFileSync(path.join(out,'rules/advertising.json'),'utf8'),fs.readFileSync(path.join(root,'rules/advertising.json'),'utf8'));
      assert.ok(fs.existsSync(path.join(out,'filters/LICENSE-StevenBlack.txt')));
      if(target==='firefox'){
        assert.equal(manifest.browser_specific_settings.gecko.strict_min_version,'128.0');
        assert.ok(manifest.background.scripts.includes('common.js'));assert.equal(manifest.background.service_worker,undefined);
      }else assert.equal(manifest.background.service_worker,'background.js');
    }
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
