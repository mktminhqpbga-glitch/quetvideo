'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const extension=path.resolve(__dirname,'../extension');
let browser,server,ui,feed;
const stored={},downloads=[];let workerListener;
const event=()=>({addListener(){}});
const workerChrome={
  action:{onClicked:event()},scripting:{executeScript:async()=>feed.addScriptTag({path:path.join(extension,'content.js')})},
  runtime:{getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener(fn){workerListener=fn;}}},
  tabs:{query:async()=>[{id:1,url:'https://www.facebook.com/example',title:'Page thử nghiệm'}],get:async()=>({id:1,url:'https://www.facebook.com/example'}),update:async()=>{},create:async()=>{},onRemoved:event(),onUpdated:event(),
    sendMessage:async(id,message)=>feed.evaluate(message=>new Promise(resolve=>window._qvContentListeners.forEach(fn=>fn(message,{},resolve))),message)},
  storage:{local:{get:async keys=>Object.fromEntries(keys.filter(k=>k in stored).map(k=>[k,stored[k]])),set:async values=>{
    const changes={};for(const [key,value]of Object.entries(values)){changes[key]={newValue:JSON.parse(JSON.stringify(value))};stored[key]=JSON.parse(JSON.stringify(value));}
    if(ui)await ui.evaluate(changes=>{for(const fn of window._qvStorageListeners||[])fn(changes,'local');},changes);
  }}},
  downloads:{download:async options=>{downloads.push(options);return downloads.length;}}
};
const context=vm.createContext({chrome:workerChrome,crypto:webcrypto,URL,TextEncoder,console});
context.importScripts=name=>vm.runInContext(fs.readFileSync(path.join(extension,name),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(extension,'background.js'),'utf8'),context);
function send(message,sender={url:'chrome-extension://test/browser.html'}){return new Promise(resolve=>workerListener(message,sender,resolve));}
async function main(){
  server=http.createServer((req,res)=>{
    if(req.url==='/feed'){
      res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><div role="feed"><div role="article"><a href="https://www.facebook.com/example/posts/101"><time datetime="2026-01-01">Hôm qua</time></a><div data-ad-preview="message">Bài đầu tiên &lt;script&gt;văn bản&lt;/script&gt;</div><img width="220" height="160" src="https://scontent.fbcdn.net/photo.jpg"><video src="blob:https://www.facebook.com/video"></video></div></div><div style="height:4000px"></div><script>let added=false;addEventListener('scroll',()=>{if(added)return;added=true;const a=document.createElement('div');a.setAttribute('role','article');a.innerHTML='<a href="https://www.facebook.com/example/posts/102">Hôm nay</a><div data-ad-preview="message">Bài tải sau khi cuộn</div>';document.querySelector('[role=feed]').append(a);});</script>`);
    }
    const name=req.url.slice(1);if(!['browser.html','browser.js','style.css'].includes(name)){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(extension,name)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
  const bcontext=await browser.newContext();await bcontext.route('https://scontent.fbcdn.net/**',route=>route.abort());
  feed=await bcontext.newPage();await feed.goto(origin+'/feed');
  await feed.exposeFunction('_qvContentSend',message=>send(message,{tab:{id:1},url:'https://www.facebook.com/example'}));
  await feed.evaluate(()=>{window._qvContentListeners=[];window.chrome={runtime:{onMessage:{addListener:fn=>window._qvContentListeners.push(fn)},sendMessage:message=>window._qvContentSend(message)}};});
  ui=await bcontext.newPage();const errors=[];ui.on('pageerror',e=>errors.push(e.message));
  await ui.exposeFunction('_qvUiSend',message=>send(message));
  await ui.addInitScript(()=>{window._qvStorageListeners=[];window.chrome={runtime:{sendMessage:message=>window._qvUiSend(message)},storage:{onChanged:{addListener:fn=>window._qvStorageListeners.push(fn)}},downloads:{download:async()=>1},tabs:{create:async()=>{}}};});
  await ui.goto(origin+'/browser.html');
  await ui.locator('#tabs').click();await ui.waitForFunction(()=>document.querySelector('#sourceTab').options.length===1);
  await ui.locator('#limit').fill('2');await ui.locator('#start').click();
  await ui.waitForFunction(()=>document.querySelectorAll('article').length===2);
  await ui.waitForFunction(()=>document.querySelector('#scanState').textContent.includes('Đã đạt số bài'));
  await ui.waitForFunction(()=>document.querySelector('#status').textContent.includes('Đã đạt số bài'));
  assert.match(await ui.locator('#scanDiagnostics').innerText(),/khối bài/);
  assert.equal(stored.browserPosts.length,2);assert.equal(stored.browserPosts[0].videoNeedsManual,true);
  assert.equal(stored.browserPosts[0].images.length,1);
  assert.match(stored.browserPosts[1].text,/sau khi cuộn/);
  await ui.locator('#selectAll').check();assert.equal(await ui.locator('#selectedCount').innerText(),'2 đã chọn');
  await ui.locator('#saveMedia').click();await ui.waitForFunction(()=>document.querySelector('#status').textContent.includes('Đã gửi 1 yêu cầu'));
  assert.equal(downloads.length,1);assert.equal(downloads[0].url,'https://scontent.fbcdn.net/photo.jpg');
  assert.match(downloads[0].filename,/^Quetvideo\/101\//);
  const forged=await send({type:'qv:batch',session:stored.browserScan.session,posts:[],count:99},{tab:{id:999},url:'https://www.facebook.com/evil'});
  assert.equal(forged.ok,false);
  stored.browserScan={...stored.browserScan,running:true};
  const recovered=await send({type:'qv:state'});assert.equal(recovered.scan.running,false);
  assert.deepEqual(errors,[]);
  console.log('PASS browser-only scan: actual DOM extraction, automatic scrolling loads next post, deduplication, stop at limit, local storage, selection, direct-media download request, blob-video warning, sender validation and stale-scan recovery. Chrome APIs mocked; no Facebook network requests.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
