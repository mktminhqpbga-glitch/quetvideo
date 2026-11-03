'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const executable=process.env.PYTHON||path.join(root,'.venv','bin','python');
const server=spawn(executable,['-m','tests.fixture_server'],{cwd:root,stdio:['ignore','pipe','pipe']});
let browser,staticServer;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'fb-extension-test-'));
async function main(){
  const key=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(Error('Bridge startup timeout')),15000);
    server.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/Mã ghép nối extension \(chỉ dùng trên máy bạn\): ([^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
    server.once('exit',code=>{clearTimeout(timer);reject(Error('Bridge exited: '+code));});
  });
  const unauthorized=await fetch('http://127.0.0.1:8765/api/posts');assert.equal(unauthorized.status,401);
  const extension=path.join(root,'extension');
  const uiOnly=process.env.UI_ONLY==='1';
  browser=await chromium.launchPersistentContext(profile,{
    headless:true,...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),
    args:['--no-sandbox',...(uiOnly?[]:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`])]
  });
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(uiOnly){
    await page.addInitScript(()=>{window.chrome={storage:{session:{get:async()=>({}),set:async()=>{}}}};});
    await page.route('http://127.0.0.1:8765/api/**',async route=>{
      const request=route.request();
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}});
      const response=await fetch(request.url(),{method:request.method(),headers:{Authorization:request.headers().authorization,'Content-Type':'application/json',Origin:'chrome-extension://synthetic-test'},...(request.postData()?{body:request.postData()}:{})});
      assert.equal(response.headers.get('access-control-allow-origin'),'chrome-extension://synthetic-test');
      return route.fulfill({status:response.status,body:await response.text(),headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
    });
    staticServer=http.createServer((req,res)=>{
      const name=req.url.slice(1);
      if(!['app.html','app.js','style.css'].includes(name)){res.writeHead(404);return res.end();}
      res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
      res.end(fs.readFileSync(path.join(extension,name)));
    });
    await new Promise(resolve=>staticServer.listen(0,'127.0.0.1',resolve));
    await page.goto(`http://127.0.0.1:${staticServer.address().port}/app.html`);
  }else{
    let [worker]=browser.serviceWorkers();if(!worker)worker=await browser.waitForEvent('serviceworker');
    const id=new URL(worker.url()).host;
    await page.goto(`chrome-extension://${id}/app.html`);
  }
  await page.locator('#key').fill(key);await page.locator('#connect').click();
  await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('Đã kết nối'));
  await page.locator('#source').fill('test');await page.locator('#scan').click();
  await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  assert.match(await page.locator('article').first().innerText(),/<script>/);
  await page.locator('#all').check();assert.equal(await page.locator('#count').innerText(),'2 đã chọn');
  await page.locator('#download').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('article label')].every(x=>x.textContent.includes('Đã tải')));
  await page.locator('#rights').check();
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#publish').click();
  assert.equal(await page.locator('article label').filter({hasText:'Đã đăng'}).count(),0);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#publish').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('article label')].every(x=>x.textContent.includes('Đã đăng')));
  assert.equal((await page.locator('article small').allTextContents()).filter(t=>t.includes('Kết quả API')).length,2);
  await page.locator('#publish').click();assert.match(await page.locator('#status').innerText(),/Chỉ chọn bài đã tải/);
  assert.deepEqual(errors,[]);
  console.log('PASS '+(uiOnly?'browser UI harness (Chrome storage mocked; not an installed extension)':'actual Chrome extension')+': pairing, auth rejection, scan, safe text rendering, selection, download, cancel/confirm publish, duplicate prevention, no JS errors. Facebook upstream calls mocked.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(staticServer)staticServer.close();server.kill();fs.rmSync(profile,{recursive:true,force:true});});
