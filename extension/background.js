importScripts('browser-core.js');
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:chrome.runtime.getURL('browser.html')}));
let operations=Promise.resolve();
async function state(){const value=await chrome.storage.local.get(['browserPosts','browserScan']);return {posts:value.browserPosts||[],scan:value.browserScan||{running:false,reason:'Chưa quét.'}};}
async function handle(message,sender){
  const current=await state();
  if(['qv:batch','qv:done'].includes(message.type)){
    if(sender.tab?.id!==current.scan.tabId||message.session!==current.scan.session||!qvCore.facebookUrl(sender.url))throw Error('Phiên quét không còn hợp lệ.');
    if(message.type==='qv:batch'){
      if(!current.scan.running)throw Error('Phiên quét đã dừng.');
      if(!Array.isArray(message.posts)||message.posts.length>200)throw Error('Kết quả quét không hợp lệ.');
      const posts=qvCore.merge(current.posts,message.posts);
      const diagnostics={};
      for(const key of ['round','articleCandidates','postLinks','elapsedSeconds','scrollTop','scrollHeight','viewportHeight']){const value=message.diagnostics?.[key];if(Number.isFinite(value)&&value>=0)diagnostics[key]=Math.min(Math.round(value),1e9);}
      diagnostics.innerScroll=message.diagnostics?.innerScroll===true;
      await chrome.storage.local.set({browserPosts:posts,browserScan:{...current.scan,count:message.count||0,diagnostics,lastUpdate:Date.now(),reason:message.count?'Đang tự cuộn và thu thập bài…':'Đang kiểm tra trang; chưa thu được bài. Xem dòng chẩn đoán bên dưới.'}});
    }else await chrome.storage.local.set({browserScan:{...current.scan,running:false,count:message.count||0,lastUpdate:Date.now(),reason:String(message.reason||'Đã dừng.').slice(0,600)}});
    return {ok:true};
  }
  if(!sender.url?.startsWith(chrome.runtime.getURL('')))throw Error('Chỉ nhận lệnh từ giao diện extension.');
  if(message.type==='qv:state'){
    if(current.scan.running){
      let alive=false;try{alive=(await chrome.tabs.sendMessage(current.scan.tabId,{type:'qv:ping'}))?.running===true;}catch{}
      if(!alive){current.scan={...current.scan,running:false,reason:'Phiên quét trước không còn chạy. Có thể bắt đầu lại; kết quả đã lưu vẫn còn.'};await chrome.storage.local.set({browserScan:current.scan});}
    }return {ok:true,...current};
  }
  if(message.type==='qv:tabs'){
    const tabs=await chrome.tabs.query({url:['https://*.facebook.com/*']});
    return {ok:true,tabs:tabs.map(t=>({id:t.id,title:t.title||t.url,url:t.url}))};
  }
  if(message.type==='qv:startScan'){
    if(current.scan.running)throw Error('Đang có một phiên quét. Bấm Dừng trước khi bắt đầu phiên mới.');
    const limit=Number(message.limit);if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('Số bài phải từ 1 đến 200.');
    const tab=await chrome.tabs.get(Number(message.tabId));if(!qvCore.facebookUrl(tab.url))throw Error('Chọn một tab Facebook HTTPS đang mở.');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
    const scan={running:true,tabId:tab.id,source:tab.url,session:crypto.randomUUID(),count:0,reason:'Đang bắt đầu…'};
    await chrome.storage.local.set({browserScan:scan});
    try{
      const response=await chrome.tabs.sendMessage(tab.id,{type:'qv:start',limit,session:scan.session});
      if(!response?.ok)throw Error(response?.error||'Không thể khởi động quét.');
      await chrome.tabs.update(tab.id,{active:true});
    }catch(e){await chrome.storage.local.set({browserScan:{...scan,running:false,reason:e.message}});throw e;}
    return {ok:true};
  }
  if(message.type==='qv:stopScan'){
    if(current.scan.running){
      try{await chrome.tabs.sendMessage(current.scan.tabId,{type:'qv:stop'});
        await chrome.storage.local.set({browserScan:{...current.scan,reason:'Đang dừng…'}});
      }catch{await chrome.storage.local.set({browserScan:{...current.scan,running:false,reason:'Tab nguồn đã đóng hoặc tải lại.'}});}
    }return {ok:true};
  }
  if(message.type==='qv:clear'){
    if(current.scan.running)throw Error('Dừng quét trước khi xóa danh sách.');
    await chrome.storage.local.set({browserPosts:[]});return {ok:true};
  }
  if(message.type==='qv:download'){
    const ids=message.ids;if(!Array.isArray(ids)||!ids.length||ids.length>2000)throw Error('Chọn ít nhất một bài.');
    const posts=current.posts.filter(p=>ids.includes(p.id));
    let requested=0,failed=0,manual=0;
    for(const post of posts){
      if(post.videoNeedsManual)manual++;
      let index=0;
      for(const [kind,urls] of [['photo',post.images],['video',post.videos]])for(const raw of urls){
        const url=qvCore.mediaUrl(raw);if(!url)continue;
        const ext=kind==='photo'?(/\.png(?:\?|$)/i.test(url)?'png':/\.webp(?:\?|$)/i.test(url)?'webp':'jpg'):'mp4';
        try{await chrome.downloads.download({url,filename:`Quetvideo/${post.id}/${kind}-${++index}.${ext}`,conflictAction:'uniquify',saveAs:false});requested++;}catch{failed++;}
      }
    }return {ok:true,requested,failed,manual};
  }
  throw Error('Lệnh không hợp lệ.');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  operations=operations.then(()=>handle(message,sender)).then(reply,error=>reply({ok:false,error:error.message||'Extension gặp lỗi.'}));
  return true;
});
function tabEnded(tabId){operations=operations.then(async()=>{const current=await state();if(current.scan.running&&current.scan.tabId===tabId)await chrome.storage.local.set({browserScan:{...current.scan,running:false,reason:'Tab nguồn đã đóng hoặc chuyển trang. Kết quả đã lưu vẫn còn.'}});}).catch(()=>{});}
chrome.tabs.onRemoved.addListener(tabEnded);
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='loading')tabEnded(tabId);});
