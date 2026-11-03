'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const content=path.resolve(__dirname,'../extension/content.js');let browser,server;
const wrap=html=>'<!doctype html><meta charset="utf-8">'+html;
const fixtures={
 empty:wrap('<main>Trang chưa hiển thị bài viết</main>'),
 nested:wrap('<div role="article"><div role="feed"><div role="article"><a href="https://www.facebook.com/example/posts/201">Ngày đăng</a><div data-ad-preview="message">Bài lồng bên trong một khối article khác</div></div></div></div>'),
 noLink:wrap('<div role="article"><a href="#">2 giờ</a><div data-ad-preview="message">Nội dung vẫn phải được thu thập khi Facebook chưa gắn permalink</div></div>'),
 profile:wrap('<div role="article"><a href="#">2 giờ</a><div data-ad-preview="message">Bài trên Page có URL profile.php cần giữ đúng ID nguồn</div></div>'),
 reel:wrap('<div style="height:300px"><a href="https://www.facebook.com/reels/202">Reel</a><video width="220" height="160"></video><div dir="auto">Video trên lưới không có role article</div></div>'),
 share:wrap('<div role="article"><a href="https://www.facebook.com/share/p/sharetoken/">Link chia sẻ</a><div data-ad-preview="message">Bài có dạng liên kết share/p trên Facebook</div></div>'),
 inner:wrap('<div id="scroll" role="feed" style="height:240px;overflow-y:auto"><div role="article"><a href="https://www.facebook.com/example/posts/203">Ngày đăng</a><div data-ad-preview="message">Bài đầu tiên trong khung cuộn</div></div><div style="height:3000px"></div></div><script>let added=false;document.querySelector("#scroll").addEventListener("scroll",()=>{if(added)return;added=true;const e=document.createElement("div");e.setAttribute("role","article");e.innerHTML=\'<a href="https://www.facebook.com/example/posts/204">Ngày đăng</a><div data-ad-preview="message">Bài thứ hai sau khi cuộn bên trong</div>\';document.querySelector("#scroll").append(e);});</script>'),
 hydrated:wrap('<div role="article"><a id="timestamp" href="#">2 giờ</a><div data-ad-preview="message">Nội dung giữ nguyên trong lúc permalink được tải bổ sung</div></div><div style="height:3000px"></div><script>addEventListener("scroll",()=>document.querySelector("#timestamp").href="https://www.facebook.com/example/posts/205");</script>')
};
async function main(){
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');const name=new URL(req.url,'http://localhost').pathname.slice(1);res.end(fixtures[name==='profile.php'?'profile':name]||wrap('Không có bài'));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
 for(const name of Object.keys(fixtures).filter(n=>!process.env.LAYOUT||n===process.env.LAYOUT)){
  const page=await browser.newPage(),messages=[];
  await page.exposeFunction('_capture',message=>{messages.push(message);return {ok:true};});
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+(name==='profile'?'profile.php?id=61596177991080':name));
  await page.evaluate(()=>{window._listeners=[];window.chrome={runtime:{onMessage:{addListener:fn=>window._listeners.push(fn)},sendMessage:message=>window._capture(message)}};});
  await page.addScriptTag({path:content});
  await page.evaluate(limit=>window._listeners[0]({type:'qv:start',session:'test',limit},{},()=>{}),name==='inner'||name==='hydrated'?2:1);
  if(name==='empty'){
    const deadline=Date.now()+35000;while(!messages.some(m=>m.type==='qv:done')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
    const done=messages.find(m=>m.type==='qv:done');assert.ok(done,'Empty page did not stop');
    assert.equal(done.count,0);assert.match(done.reason,/Chưa nhận diện/);assert.equal(done.diagnostics.articleCandidates,0);
    assert.equal(done.diagnostics.round,8);await page.close();console.log('PASS content layout: empty (explicit failure reason and diagnostics)');continue;
  }
  const deadline=Date.now()+10000;while(!messages.some(m=>m.type==='qv:batch')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
  assert.ok(messages.some(m=>m.posts?.length),'No data for '+name);
  if(name==='noLink')assert.equal(messages.find(m=>m.posts?.length).posts[0].permalinkFound,false);
  if(name==='profile'){
    const post=messages.find(m=>m.posts?.length).posts[0];
    assert.equal(new URL(post.url).searchParams.get('id'),'61596177991080');
    assert.equal(new URL(post.sourcePage).searchParams.get('id'),'61596177991080');
  }
  if(name==='reel')assert.equal(messages.find(m=>m.posts?.length).posts[0].videoNeedsManual,true);
  if(name==='inner'){
   while(!messages.some(m=>m.count===2)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
   assert.ok(messages.some(m=>m.count===2),'Inner container was not scrolled');
   assert.ok(messages.some(m=>m.diagnostics?.innerScroll),'Inner scroll not diagnosed');
  }
  if(name==='hydrated'){
   while(!messages.some(m=>m.posts?.some(p=>p.id==='205'))&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
   assert.ok(messages.some(m=>m.posts?.some(p=>p.id==='205')),'Hydrated link was not picked up');
   assert.ok(messages.filter(m=>m.type==='qv:batch').every(m=>m.count===1),'Hydrated link counted as another post');
  }
  await page.evaluate(()=>window._listeners[0]({type:'qv:stop'},{},()=>{}));
  await page.close();console.log('PASS content layout: '+name);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
