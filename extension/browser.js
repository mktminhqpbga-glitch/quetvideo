'use strict';
const $=id=>document.getElementById(id);
let posts=[],scan={},selected=new Set(),busy=false;
function status(text){$('status').textContent=text;}
function progress(){return (scan.running?'Đang quét':'Đã dừng')+' · '+(scan.count||0)+' bài trong đợt · '+posts.length+' bài đã lưu. '+(scan.reason||'');}
async function send(type,values={}){const result=await chrome.runtime.sendMessage({type,...values});if(!result?.ok)throw Error(result?.error||'Không kết nối được extension. Tải lại extension trong chrome://extensions.');return result;}
function render(){
  const valid=new Set(posts.map(p=>p.id));for(const id of selected)if(!valid.has(id))selected.delete(id);
  $('scanState').textContent=progress();
  $('sourceUrl').textContent='Tab được chọn: '+($('sourceTab').selectedOptions[0]?.dataset.url||scan.source||'chưa chọn');
  const d=scan.diagnostics;
  $('scanDiagnostics').textContent=d?'Vòng '+(d.round||0)+' · '+(d.articleCandidates||0)+' khối bài · '+(d.postLinks||0)+' liên kết bài · '+(d.elapsedSeconds||0)+' giây · vị trí cuộn '+(d.scrollTop||0)+'/'+(d.scrollHeight||0)+(d.innerScroll?' (khung cuộn bên trong)':' (trang chính)'):'Chưa có dữ liệu chẩn đoán.';
  $('start').disabled=busy||scan.running||!$('sourceTab').value;$('stop').disabled=busy||!scan.running;
  $('clear').disabled=busy||scan.running||!posts.length;
  $('saveJson').disabled=busy||!selected.size;$('saveMedia').disabled=busy||!selected.size;
  $('selectedCount').textContent=selected.size+' đã chọn';
  $('selectAll').checked=posts.length>0&&selected.size===posts.length;$('selectAll').indeterminate=selected.size>0&&selected.size<posts.length;
  const fragment=document.createDocumentFragment();
  for(const post of posts){
    const article=document.createElement('article'),label=document.createElement('label'),box=document.createElement('input');
    box.type='checkbox';box.checked=selected.has(post.id);box.addEventListener('change',()=>{box.checked?selected.add(post.id):selected.delete(post.id);render();});
    label.append(box,document.createTextNode(' Bài '+post.id));article.append(label);
    const text=document.createElement('pre');text.textContent=post.text||'(Không nhận diện được nội dung văn bản)';article.append(text);
    const summary=document.createElement('small');summary.textContent=post.images.length+' ảnh · '+post.videos.length+' video có URL trực tiếp'+(post.videoNeedsManual?' · Có video cần tải thủ công':'');article.append(summary);
    const source=document.createElement('a');source.href=post.url;source.target='_blank';source.rel='noopener noreferrer';source.textContent=post.permalinkFound===false?'Mở Page nguồn · chưa lấy được link riêng của bài':'Mở bài gốc';article.append(source);
    const copy=document.createElement('button');copy.textContent='Sao chép nội dung';copy.addEventListener('click',()=>navigator.clipboard.writeText(post.text).then(()=>status('Đã sao chép. Mở Page đích để dán nội dung và chọn media đã tải.')).catch(()=>status('Chrome không cho sao chép. Hãy chọn văn bản bài bên trên rồi nhấn Copy.')));article.append(copy);
    fragment.append(article);
  }$('browserPosts').replaceChildren(fragment);
}
async function refresh(announce=false){const result=await send('qv:state');posts=result.posts;scan=result.scan;render();if(announce)status(progress());}
async function task(fn){busy=true;render();try{await fn();}catch(e){status(e.message);}finally{busy=false;render();}}
$('tabs').addEventListener('click',()=>task(async()=>{const result=await send('qv:tabs');$('sourceTab').replaceChildren();for(const tab of result.tabs){const option=document.createElement('option');option.value=tab.id;option.textContent=tab.title;option.title=tab.url;option.dataset.url=tab.url;$('sourceTab').append(option);}status(result.tabs.length?'Chọn đúng tab Page nguồn rồi bấm Bắt đầu tự quét.':'Chưa thấy tab Facebook. Mở Page nguồn bằng Chrome này rồi tìm lại.');}));
$('sourceTab').addEventListener('change',render);
$('start').addEventListener('click',()=>task(async()=>{await send('qv:startScan',{tabId:Number($('sourceTab').value),limit:Number($('limit').value)});await refresh(true);}));
$('stop').addEventListener('click',()=>task(async()=>{await send('qv:stopScan');await refresh();status('Đã gửi yêu cầu dừng.');}));
$('selectAll').addEventListener('change',()=>{selected.clear();if($('selectAll').checked)posts.forEach(p=>selected.add(p.id));render();});
$('clear').addEventListener('click',()=>{if(confirm('Xóa danh sách trong extension? Hãy xuất JSON và tải media cần giữ trước.'))task(async()=>{await send('qv:clear');await refresh();status('Đã xóa danh sách cục bộ; không xóa bài Facebook hoặc file đã tải.');});});
$('saveJson').addEventListener('click',()=>{
  const payload={format:'quetvideo-browser-v1',exportedAt:new Date().toISOString(),posts:posts.filter(p=>selected.has(p.id))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  chrome.downloads.download({url,filename:'Quetvideo/facebook-posts.json',saveAs:false,conflictAction:'uniquify'}).then(()=>status('Đã gửi yêu cầu tải JSON. Kiểm tra mục Tệp đã tải xuống của Chrome.')).catch(e=>status(e.message)).finally(()=>setTimeout(()=>URL.revokeObjectURL(url),60000));
});
$('saveMedia').addEventListener('click',()=>task(async()=>{const result=await send('qv:download',{ids:[...selected]});status('Đã gửi '+result.requested+' yêu cầu tải file; '+result.failed+' yêu cầu bị từ chối; '+result.manual+' bài có video cần tải thủ công. Kiểm tra hoàn tất/lỗi trong mục Tệp đã tải xuống của Chrome.');}));
$('openTarget').addEventListener('click',()=>{
  try{const u=new URL($('targetPage').value);if(u.protocol!=='https:'||!/(^|\.)facebook\.com$/.test(u.hostname)||u.username||u.password)throw Error();chrome.tabs.create({url:u.href});}catch{status('Nhập URL Page đích dạng https://www.facebook.com/tenpage.');}
});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.browserPosts||changes.browserScan))refresh(!!changes.browserScan).catch(e=>status(e.message));});
refresh().catch(e=>status(e.message));
