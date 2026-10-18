/* Offline verification of the two production directories. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const project=path.resolve(__dirname,'../..');
const directories=process.argv.length>2?process.argv.slice(2):['dist/chromium','dist/firefox'];
assert.equal(directories.length,2,'Pass Chromium and Firefox build directories');
const roots=directories.map(dir=>path.resolve(project,dir));
function files(root,rel=''){
  return fs.readdirSync(path.join(root,rel),{withFileTypes:true}).flatMap(entry=>{
    const name=path.join(rel,entry.name);assert.ok(!entry.isSymbolicLink(),'No build symlinks');
    return entry.isDirectory()?files(root,name):[name];
  }).sort();
}
const names=roots.map(root=>files(root));assert.deepEqual(names[0],names[1],'Builds must contain the same files');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const name of names[0]){
  assert.ok(!/^(?:tests|scripts|_metadata|\.git)(?:\/|$)/.test(name),'Production must not contain QA or browser metadata');
  if(name!=='manifest.json')assert.equal(digest(path.join(roots[0],name)),digest(path.join(roots[1],name)),name);
}
const manifests=roots.map(root=>JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))));
const version=JSON.parse(fs.readFileSync(path.join(project,'package.json'))).version;
for(const [i,manifest]of manifests.entries()){
  assert.equal(manifest.version,version);
  assert.deepEqual([...manifest.permissions].sort(),['activeTab','declarativeNetRequest','scripting','storage','webNavigation'].sort());
  assert.deepEqual([...manifest.host_permissions].sort(),['http://*/*','https://*/*']);
  assert.deepEqual(manifest.options_ui,{page:'options.html',open_in_tab:true});
  assert.equal(manifest.content_scripts.length,3);
  assert.deepEqual(manifest.content_scripts[2].js,['focus.js']);
  assert.deepEqual(manifest.content_scripts[2].css,['focus.css']);
  assert.equal(manifest.content_scripts[2].all_frames,undefined);
  for(const item of manifest.content_scripts)for(const rel of [...(item.js||[]),...(item.css||[])])assert.ok(fs.existsSync(path.join(roots[i],rel)),rel);
  for(const rel of ['popup.html','options.html','preferences.js','focus.js',...(manifest.background.scripts||[]),...(manifest.background.service_worker?[manifest.background.service_worker]:[])])assert.ok(fs.existsSync(path.join(roots[i],rel)),rel);
  const rules=manifest.declarative_net_request.rule_resources.flatMap(resource=>JSON.parse(fs.readFileSync(path.join(roots[i],resource.path))));
  assert.equal(rules.length,new Set(rules.map(rule=>rule.id)).size,'Rule IDs must be unique across resources');
  assert.ok(rules.length<30000);
}
assert.equal(manifests[0].background.service_worker,'background.js');
assert.equal(manifests[1].browser_specific_settings.gecko.strict_min_version,'128.0');
assert.ok(manifests[1].background.scripts.indexOf('preferences.js')<manifests[1].background.scripts.indexOf('background.js'));
console.log('PASS_BUILDS',JSON.stringify({version,files:names[0].length,targets:['chromium','firefox'],newPermissions:0,onlyManifestDiffers:true}));
