/* Run with Playwright installed: node tests/browser.e2e.cjs
 * All webpages are simulated with request interception; no real accounts.
 */
const qaModules = process.env.NAVEGA_QA_MODULES || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium} = require(qaModules ? qaModules + '/playwright' : 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ext = path.resolve(process.env.NAVEGA_EXTENSION_DIR || path.join(__dirname, '..'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'navega-test-'));
const youtubeFixture = `<!doctype html><html><body>
  <article id="content">Vídeo normal</article><ytd-ad-slot-renderer id="ad">Publicidade</ytd-ad-slot-renderer>
  <div id="movie_player" class="ad-showing"><video id="video"></video>
  <button class="ytp-ad-skip-button" disabled onclick="window.skips++;document.querySelector('#movie_player').classList.remove('ad-showing')">Pular anúncio</button></div>
  <script>window.skips=0;window.ytInitialPlayerResponse={playerAds:[{}],adPlacements:[{}],videoDetails:{videoId:'fixture'},streamingData:{url:'keep'}};</script></body></html>`;
const genericFixture = `<!doctype html><html><body style="overflow:hidden">
  <article id="article">Conteúdo existente</article>
  <div id="warning" role="dialog" style="position:fixed;inset:0">Desative o bloqueador de anúncios para continuar.</div>
  <div id="login" role="dialog">Faça login para continuar.</div>
  <div id="paid" role="dialog">Disable your ad blocker and subscribe to premium.</div>
  </body></html>`;
const knownFixture = `<!doctype html><html><body>
  <div class="adblock-guard-content" inert aria-hidden="true">Portal</div>
  <main class="adblock-screen" style="position:fixed">Desative o bloqueador de anúncios</main>
  <script>
  window.probeValues=[];
  const element=document.querySelector('.adblock-guard-content');
  function advertisingGuard(){return 'adblock-guard-content'}
  const third={queue:{dispatch(value){window.probeValues.push(value);document.querySelector('.adblock-screen').remove();}}};
  element.__reactFiber$fixture={type:'div',return:{type:advertisingGuard,memoizedState:{queue:{dispatch(value){window.probeValues.push(value)}},next:{next:third}}}};
  </script></body></html>`;
(async () => {
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: true, channel: 'chromium',
      executablePath: chromium.executablePath(),
      args: ['--no-sandbox', '--disable-extensions-except=' + ext, '--load-extension=' + ext],
      viewport: {width: 1000, height: 850}, acceptDownloads: true
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const getConfig = () => worker.evaluate(async () => (await chrome.storage.local.get('config')).config);
    async function patchConfig(patch) {
      await worker.evaluate(async patch => {
        const {config} = await chrome.storage.local.get('config');
        await chrome.storage.local.set({config: {...config, ...patch}});
      }, patch);
    }
    const errors = [];
    worker.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await worker.evaluate(async () => {
      for (let i=0;i<100;i++) {
        if ((await chrome.storage.local.get('config')).config && (await chrome.scripting.getRegisteredContentScripts({ids:['navega-youtube-main','navega-popup-main']})).length === 2) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw Error('Extension failed to initialize');
    });
    await context.route('https://www.youtube.com/**', route => route.fulfill({contentType: 'text/html', body: youtubeFixture}));
    await context.route('https://fixtures.example.test/**', route => route.fulfill({contentType: 'text/html', body: genericFixture}));
    await context.route('https://tavvkkj.xyz/**', route => route.fulfill({contentType: 'text/html', body: knownFixture}));
    await context.route('https://pagead2.googlesyndication.com/**', route => route.fulfill({contentType: 'text/plain', headers: {'access-control-allow-origin': '*'}, body: 'ad'}));
    const page = await context.newPage();
    await page.goto('https://www.youtube.com/watch?v=fixture');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#ad')).display === 'none');
    assert.equal(await page.evaluate(() => typeof window.__navegaLivreYoutubeState === 'function'),true);
    assert.equal(await page.evaluate(() => 'playerAds' in window.ytInitialPlayerResponse),false);
    assert.equal(await page.evaluate(() => window.ytInitialPlayerResponse.streamingData.url),'keep');
    assert.equal(await page.locator('#content').isVisible(), true);
    assert.equal(await page.evaluate(() => window.skips), 0, 'Disabled skip button must not be clicked');
    await page.locator('.ytp-ad-skip-button').evaluate(button => button.disabled = false);
    await page.waitForFunction(() => window.skips === 1);
    console.log('PASS YouTube cosmetics, preservation of normal content, available-only skip');

    await patchConfig({skipAds: false, muteAds: true});
    await page.evaluate(() => {document.querySelector('#movie_player').classList.add('ad-showing');document.querySelector('#video').muted = false;});
    await page.waitForFunction(() => document.querySelector('#video').muted);
    await page.evaluate(() => document.querySelector('#movie_player').classList.remove('ad-showing'));
    await page.waitForFunction(() => !document.querySelector('#video').muted);
    console.log('PASS advertisement audio muting and restoration');

    const fetchAd = () => page.evaluate(async () => {
      try { return (await fetch('https://pagead2.googlesyndication.com/test.js?now=' + Date.now())).status; }
      catch { return 'blocked'; }
    });
    assert.equal(await fetchAd(), 'blocked', 'Advertising request must be blocked by actual DNR rules');
    await patchConfig({disabledHosts: ['www.youtube.com']});
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#ad')).display !== 'none');
    await worker.evaluate(async () => {
      for (let i=0;i<100;i++) {
        if ((await chrome.declarativeNetRequest.getDynamicRules()).length === 1) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw Error('Pause rule not installed');
    });
    await page.reload();
    assert.equal(await fetchAd(), 200, 'Paused site must allow advertising requests again');
    assert.equal(await page.locator('#ad').isVisible(), true);
    console.log('PASS actual network blocking, per-site pause, and reversal');

    await patchConfig({disabledHosts: [], repairHosts: []});
    await page.goto('https://fixtures.example.test/page?token=fixture-secret#private');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#warning').isVisible(), true, 'Notice repair defaults to off');
    await patchConfig({repairHosts: ['fixtures.example.test']});
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#warning')).display === 'none');
    assert.equal(await page.locator('#article').isVisible(), true);
    assert.equal(await page.locator('#login').isVisible(), true);
    assert.equal(await page.locator('#paid').isVisible(), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto');
    await patchConfig({repairHosts: []});
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#warning')).display !== 'none');
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    console.log('PASS optional advertising notice repair, no login/paywall modification, reversal');

    await patchConfig({repairHosts: ['tavvkkj.xyz']});
    await page.goto('https://tavvkkj.xyz/');
    await page.waitForFunction(() => window.probeValues.includes('allowed') && window.probeValues.includes('unavailable'));
    assert.equal(await page.locator('.adblock-guard-content').getAttribute('inert'), null);
    console.log('PASS known advertising guard adapter through MAIN world');

    await page.goto('https://fixtures.example.test/page?token=fixture-secret#private');
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({url: 'https://fixtures.example.test/*'}))[0].id);
    const popup = await context.newPage();
    await popup.goto('chrome-extension://' + extensionId + '/popup.html');
    await worker.evaluate(tabId => chrome.tabs.update(tabId, {active: true}), tabId);
    await popup.reload();
    await popup.waitForFunction(() => document.querySelector('#hostname').textContent === 'fixtures.example.test');
    await popup.locator('#tab-repair').click();
    const repaired = popup.locator('#repair');
    await repaired.click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#warning')).display === 'none');
    await popup.locator('#autoRepair').uncheck();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#warning')).display !== 'none');
    console.log('PASS popup actions and automatic-repair preference');
    const downloadPromise = popup.waitForEvent('download');
    await popup.locator('#report').click();
    const download = await downloadPromise;
    const report = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(report.page, 'https://fixtures.example.test');
    assert.equal(JSON.stringify(report).includes('fixture-secret'), false);
    console.log('PASS sanitized, user-triggered diagnostic download');
    await popup.setViewportSize({width: 390, height: 900});
    await popup.screenshot({path: path.join(os.tmpdir(), 'navega-livre-popup.png'), fullPage: true});
    await popup.locator('#tab-general').click();
    await popup.locator('#enabled').uncheck();
    await worker.evaluate(async () => {
      for(let i=0;i<100;i++) {
        if (!(await chrome.declarativeNetRequest.getEnabledRulesets()).includes('advertising')) return;
        await new Promise(resolve => setTimeout(resolve,25));
      }
      throw Error('Global pause failed');
    });
    console.log('PASS global pause disables actual static rules');
    assert.deepEqual(errors, [], 'No service worker errors');
    assert.equal((await getConfig()).enabled, false);
    console.log('ALL BROWSER TESTS PASSED');
  } finally {
    await context?.close();
    fs.rmSync(profile, {recursive: true, force: true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
