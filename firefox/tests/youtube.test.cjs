const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../youtube-main.js'),'utf8');
function fixture(responseBody){
  let event,originalResponse;
  const context=vm.createContext({URL,Response,Headers,location:{href:'https://www.youtube.com/watch?v=fixture',origin:'https://www.youtube.com'},
    document:{addEventListener:(type,fn)=>event=fn},
    fetch:async()=>originalResponse=new Response(responseBody,{headers:{'content-type':'application/json'}})});
  vm.runInContext(source,context);
  return{context,disable:()=>event({detail:{enabled:false}}),original:()=>originalResponse};
}
test('initial player metadata keeps content, media URLs, and authentication fields',()=>{
  const f=fixture('{}');
  const player={playerAds:[{ad:true}],adPlacements:[{}],streamingData:{adaptiveFormats:[{url:'https://media.example/video',signatureCipher:'preserve'}]},videoDetails:{videoId:'video'},account:{is_vip:false,token:'fixture'},nested:{adSlots:[{}],title:'keep'}};
  f.context.ytInitialPlayerResponse=player;
  assert.equal('playerAds' in player,false);assert.equal('adPlacements' in player,false);assert.equal('adSlots' in player.nested,false);
  assert.equal(player.streamingData.adaptiveFormats[0].signatureCipher,'preserve');assert.equal(player.account.is_vip,false);assert.equal(player.account.token,'fixture');
  f.disable();const second={playerAds:[{}]};f.context.ytInitialPlayerResponse=second;assert.equal('playerAds' in second,true);
});
test('fetch filtering affects only same-origin player endpoints and preserves ordinary responses',async()=>{
  const body=JSON.stringify({playerAds:[{}],videoDetails:{videoId:'fixture'},streamingData:{url:'keep'}});
  const f=fixture(body);
  const filtered=await f.context.fetch('/youtubei/v1/player');
  const value=await filtered.json();assert.equal('playerAds' in value,false);assert.equal(value.streamingData.url,'keep');
  const external=await f.context.fetch('https://other.example/youtubei/v1/player');assert.equal(external,f.original());
  const ordinary=await f.context.fetch('/api/unrelated');assert.equal(ordinary,f.original());
  f.disable();const disabled=await f.context.fetch('/youtubei/v1/player');assert.equal(disabled,f.original());
});
test('malformed and advertising-free responses are returned unchanged',async()=>{
  for(const body of ['not json','{"videoDetails":{"videoId":"keep"}}']){
    const f=fixture(body);const result=await f.context.fetch('/youtubei/v1/player');assert.equal(result,f.original());assert.equal(await result.text(),body);
  }
});
test('XSSI-prefixed player responses retain the prefix',async()=>{
  const prefix=")]}'\n";const f=fixture(prefix+'{"playerAds":[{}],"videoDetails":{"videoId":"keep"}}');
  const result=await f.context.fetch('/youtubei/v1/player');const text=await result.text();
  assert.equal(text.startsWith(prefix),true);assert.equal(JSON.parse(text.slice(prefix.length)).videoDetails.videoId,'keep');
});
