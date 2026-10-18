const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../preferences.js'),C=require('../common.js');
test('link cleaning preserves navigation, playback identifiers and encoding of unrelated parameters',()=>{
  const input='https://example.test/watch?v=ABC%2fdef&list=123&x=a+b&UTM_Source=share&fbclid=tracking#t=16';
  assert.equal(T.cleanLink(input).url,'https://example.test/watch?v=ABC%2fdef&list=123&x=a+b#t=16');
  assert.equal(T.cleanLink('https://example.test/path?ref=chapter&feature=share').url,'https://example.test/path?ref=chapter&feature=share');
  assert.equal(T.cleanLink('https://example.test/?%75tm_campaign=a&utm_source=b&utm_source=c').url,'https://example.test/');
  assert.equal(T.cleanLink('https://example.test/#route?utm_source=app').url,'https://example.test/#route?utm_source=app');
});
test('signed and authenticated links remain byte-identical even when trackers are present',()=>{
  for(const param of ['sig=abc','X-Amz-Signature=abc','X-Goog-Credential=abc','token=secret','access_token=secret','expires=123']){
    const input='https://cdn.example.test/file?raw=a%2fb+'+'&'+param+'&utm_source=mail#download';
    const result=T.cleanLink(input);assert.equal(result.url,input);assert.equal(result.protected,true);assert.equal(result.removed.length,0);
  }
});
test('link tool rejects script URLs, local files, credentials and oversized input',()=>{
  for(const value of ['javascript:alert(1)','file:///etc/passwd','https://user:pass@example.test/','not a link','https://example.test/'+ 'x'.repeat(8192)])assert.throws(()=>T.cleanLink(value));
});
test('local backups round-trip all supported choices without counters or arbitrary page data',()=>{
  const raw={...C.normalizeConfig({privacy:false,disabledHosts:['news.example']}),cookies:'secret'};
  const backup=T.createBackup(raw,{theme:'light',focusShorts:true,history:['private']},'0.7.0');
  const result=T.readBackup(JSON.stringify(backup));assert.equal(result.config.privacy,false);assert.equal(result.preferences.focusShorts,true);
  assert.deepEqual(result.config.disabledHosts,['news.example']);assert.equal(JSON.stringify(backup).includes('secret'),false);assert.equal(JSON.stringify(backup).includes('private'),false);
});
test('backup validation rejects future schemas, malformed options, invalid hosts and prototype keys',()=>{
  const backup=()=>T.createBackup(C.normalizeConfig(),T.normalize(),'0.7.0');
  for(const change of [b=>b.schema=2,b=>b.config.enabled='false',b=>b.config.disabledHosts=['https://page.test/path'],
    b=>b.config.repairHosts=Array(501).fill('page.test'),b=>b.preferences.theme='remote',b=>b.preferences.focusShorts='true',
    b=>b.config=JSON.parse('{"__proto__":{}}')]){
    const b=backup();change(b);assert.throws(()=>T.readBackup(JSON.stringify(b)));
  }
  assert.throws(()=>T.readBackup('x'.repeat(T.BACKUP_LIMIT+1)));assert.throws(()=>T.readBackup('{'));
});
test('optional focus defaults do not change the advertising engine configuration',()=>{
  assert.deepEqual(T.normalize(),{theme:'system',focusShorts:false,focusComments:false,focusRelated:false});
  assert.equal(T.normalize({theme:'invalid',focusShorts:1}).focusShorts,false);
  assert.equal(C.OPTIONS.includes('focusShorts'),false);
});
test('maximum-size valid host lists can be exported and imported within the bounded backup size',()=>{
  const hosts=Array.from({length:500},(_,i)=>'a'.repeat(60)+'.'+'b'.repeat(60)+'.'+'c'.repeat(60)+'.'+String(i)+'.example');
  const config=C.normalizeConfig({disabledHosts:hosts,repairHosts:hosts});
  const text=JSON.stringify(T.createBackup(config,T.normalize(),'0.7.0'));
  assert.ok(Buffer.byteLength(text)<T.BACKUP_LIMIT);assert.equal(T.readBackup(text).config.disabledHosts.length,500);
});
