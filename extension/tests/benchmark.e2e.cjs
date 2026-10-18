/* Read the real public test's result in a fresh, extension-only profile.
 * Do not alter the test, its requests, its score, browser fetch, or DOM probes.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const modules=process.env.NAVEGA_QA_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=require(modules?modules+'/playwright':'playwright');
const extension=path.resolve(process.env.NAVEGA_EXTENSION_DIR||path.join(__dirname,'..'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'navega-benchmark-'));
(async()=>{let context;try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--no-sandbox','--disable-extensions-except='+extension,'--load-extension='+extension]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const engine=context.browser()?.version();await worker.evaluate(async()=>{await queue;await init();});
  const page=await context.newPage();const blockedByClient=[];
  page.on('requestfailed',r=>{if(r.failure()?.errorText==='net::ERR_BLOCKED_BY_CLIENT'){try{blockedByClient.push(new URL(r.url()).hostname);}catch{}}});
  await page.goto('https://adblock.turtlecute.org/',{waitUntil:'domcontentloaded',timeout:60000});
  const retest=page.getByRole('button',{name:/re-test|retest|test again/i}).first();if(await retest.count())await retest.click();
  await page.waitForFunction(()=>{for(let i=0;i<localStorage.length;i++){try{const x=JSON.parse(localStorage.getItem(localStorage.key(i)));const a=x?.results?.at(-1)?.abt;if(a?.total>0&&a.blocked+a.notblocked>=a.total)return true;}catch{}}return false;},{},{timeout:90000});
  const result=await page.evaluate(()=>{for(let i=0;i<localStorage.length;i++){try{const x=JSON.parse(localStorage.getItem(localStorage.key(i)));const a=x?.results?.at(-1)?.abt;if(a?.total>0&&a.blocked+a.notblocked>=a.total)return {total:a.total,blocked:a.blocked,notblocked:a.notblocked,cosmetics:a.cosmetic_test,scripts:a.script};}catch{}}return null;});
  const proof={site:'https://adblock.turtlecute.org/',engine,version:'0.5.0',...result,percent:100*result.blocked/result.total,requestsExplicitlyBlockedByClient:new Set(blockedByClient).size};
  fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/turtlecute-chromium.json',JSON.stringify(proof,null,2)+'\n');console.log('TURTLECUTE_MEASURED',JSON.stringify(proof));
  // The site counts network failures too. This score is a site measurement,
  // not a percentage of ads removed throughout the internet.
}finally{await context?.close();fs.rmSync(profile,{recursive:true,force:true});}})().catch(error=>{console.error('BENCHMARK_UNAVAILABLE',error.message);process.exitCode=1;});
