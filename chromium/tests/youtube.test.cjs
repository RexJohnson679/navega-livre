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
function xhrFixture(){
  let listener;
  class FakeXHR {
    constructor(){this.readyState=0;this.status=0;this.responseType='';this._text='';this._json=null;}
    open(method,url){this.readyState=1;this.status=0;this.responseType='';this._text='';this._json=null;this.url=url;}
    get responseText(){if(!['','text'].includes(this.responseType))throw new Error('InvalidStateError');return this._text;}
    get response(){return this.responseType==='json'?this._json:this._text;}
    finish(body,type='',status=200){this._text=body;this.responseType=type;this.status=status;this.readyState=4;if(type==='json')this._json=JSON.parse(body);}
  }
  const context=vm.createContext({URL,Response,Headers,XMLHttpRequest:FakeXHR,
    location:{href:'https://www.youtube.com/watch?v=fixture',origin:'https://www.youtube.com'},
    document:{addEventListener:(type,fn)=>listener=fn}});
  vm.runInContext(source,context);
  return{context,create:()=>new FakeXHR(),disable:()=>listener({detail:{enabled:false}}),state:()=>context.__navegaLivreYoutubeState()};
}
test('XHR text and JSON player responses remove advertising fields, not video data',()=>{
  const f=xhrFixture(),xhr=f.create();xhr.open('POST','/youtubei/v1/player');
  xhr.finish('{"playerAds":[{}],"streamingData":{"url":"keep"},"videoDetails":{"videoId":"keep"}}');
  const result=JSON.parse(xhr.responseText);assert.equal('playerAds' in result,false);assert.equal(result.streamingData.url,'keep');
  assert.equal(xhr.response,xhr.responseText);assert.equal(f.state().xhrMatched,1);assert.equal(f.state().adFieldsRemoved,1);
  xhr.open('POST','/youtubei/v1/player');xhr.finish('{"adSlots":[{}],"videoDetails":{"videoId":"next"}}','json');
  assert.equal('adSlots' in xhr.response,false);assert.equal(xhr.response.videoDetails.videoId,'next');
  assert.throws(()=>xhr.responseText,/InvalidStateError/);assert.equal(f.state().xhrMatched,2);
});
test('XHR leaves partial, failed, disabled, unrelated and reused non-player requests unchanged',()=>{
  const f=xhrFixture(),xhr=f.create(),body='{"playerAds":[{}],"videoDetails":{"videoId":"keep"}}';
  xhr.open('POST','/youtubei/v1/player');xhr._text=body;xhr.readyState=3;assert.equal(xhr.responseText,body);
  xhr.finish(body,'',403);assert.equal(xhr.responseText,body);
  xhr.open('GET','/api/ordinary');xhr.finish(body);assert.equal(xhr.responseText,body);
  xhr.open('POST','https://www.youtube.com.attacker.test/youtubei/v1/player');xhr.finish(body);assert.equal(xhr.responseText,body);
  xhr.open('POST','/youtubei/v1/player');xhr.finish(body);f.disable();assert.equal(xhr.responseText,body);
  assert.equal(f.state().xhrMatched,0);
});
test('recognized YouTube API origin is filtered, while diagnostics contain no response data',async()=>{
  const f=fixture('{"playerAds":[{}],"account":{"token":"fixture-secret"},"videoDetails":{"videoId":"keep"}}');
  const result=await f.context.fetch('https://youtubei.googleapis.com/youtubei/v1/player');
  const value=await result.json();assert.equal('playerAds' in value,false);assert.equal(value.account.token,'fixture-secret');
  const diagnostic=f.context.__navegaLivreYoutubeState();assert.equal(diagnostic.fetchMatched,1);
  assert.equal(JSON.stringify(diagnostic).includes('fixture-secret'),false);
});
test('reusing an XHR does not delete a response accessor subsequently installed by the page',()=>{
  const f=xhrFixture(),xhr=f.create();xhr.open('POST','/youtubei/v1/player');
  Object.defineProperty(xhr,'responseText',{configurable:true,value:'page-owned'});
  xhr.open('GET','/ordinary');xhr.finish('{}');assert.equal(xhr.responseText,'page-owned');
});
