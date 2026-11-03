'use strict';
const $ = id => document.getElementById(id);
let posts = [], connected = false, busy = false, configured = false;
const selected = new Set();
const labels = {scanned:'Đã quét',downloaded:'Đã tải, sẵn sàng đăng',download_failed:'Tải thất bại',published:'Đã đăng',publishing:'Đang đăng',uncertain:'Chưa rõ kết quả: kiểm tra Page thủ công'};
function status(message) {$('status').textContent=message;}
async function api(path, body) {
  const response=await fetch('http://127.0.0.1:8765/api/'+path, {
    method:body?'POST':'GET', headers:{Authorization:'Bearer '+$('key').value.trim(),'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json();
  if(data.posts){posts=data.posts;render();}
  if(!response.ok)throw new Error(data.error||'Bridge trả lỗi.');
  return data;
}
function controls(){
  $('count').textContent=selected.size+' đã chọn';
  ['scan','refresh'].forEach(id=>$(id).disabled=busy||!connected);
  $('download').disabled=busy||!connected||!selected.size;
  $('publish').disabled=busy||!connected||!configured||!selected.size||!$('rights').checked;
  $('export').disabled=busy||!posts.length;
  $('connect').disabled=busy;
  ['key','source','pages','all','rights'].forEach(id=>$(id).disabled=busy);
  $('all').checked=posts.length>0&&selected.size===posts.length;
  $('all').indeterminate=selected.size>0&&selected.size<posts.length;
}
function render(){
  const valid=new Set(posts.map(p=>p.id));for(const id of selected)if(!valid.has(id))selected.delete(id);
  $('posts').replaceChildren();
  for(const post of posts){
    const row=document.createElement('article'),label=document.createElement('label'),box=document.createElement('input');
    box.type='checkbox';box.checked=selected.has(post.id);box.disabled=busy;
    box.addEventListener('change',()=>{box.checked?selected.add(post.id):selected.delete(post.id);controls();});
    label.append(box,document.createTextNode(' '+post.id+' · '+(labels[post.state]||post.state)));row.append(label);
    const info=document.createElement('small');info.textContent=(post.time||'Không rõ thời gian')+' · '+post.images.length+' ảnh · '+(post.has_video?'Có video':'Không video');row.append(info);
    const content=document.createElement('pre');content.textContent=post.text;row.append(content);
    try{const url=new URL(post.url);if(url.protocol==='https:'&&['facebook.com','www.facebook.com','m.facebook.com'].includes(url.hostname)){
      const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Xem bài nguồn';row.append(link);
    }}catch{}
    if(post.attachments.length){const files=document.createElement('small');files.textContent='Đã lưu: '+post.attachments.map(a=>a.name).join(', ');row.append(files);}
    if(post.result){const result=document.createElement('small');result.textContent='Kết quả API: '+JSON.stringify(post.result);row.append(result);}
    if(post.error){const error=document.createElement('p');error.className='error';error.textContent=post.error;row.append(error);}
    $('posts').append(row);
  }controls();
}
async function task(fn){busy=true;render();status('Đang xử lý… Giữ tab này mở.');try{await fn();}catch(e){status(e.message||'Không kết nối được bridge.');}finally{busy=false;render();}}
$('connect').addEventListener('click',()=>task(async()=>{
  connected=false;const info=await api('status');connected=true;
  configured=Boolean(info.target_page&&info.token_configured&&info.graph_version);
  $('connection').textContent='Đã kết nối bridge trên máy bạn';
  $('target').textContent='Page đích: '+(info.target_page||'chưa cấu hình')+' · Graph API: '+(info.graph_version||'chưa cấu hình');
  await chrome.storage.session.set({pairingKey:$('key').value.trim()});
  await api('posts');status('Đã kết nối. Có thể quét hoặc tải lại danh sách.');
}));
$('key').addEventListener('input',()=>{connected=false;configured=false;controls();});
$('scan').addEventListener('click',()=>task(async()=>{const data=await api('scan',{source:$('source').value.trim(),pages:Number($('pages').value)});status('Quét xong: thêm '+data.added+' bài. Kết quả phụ thuộc khả năng truy cập Facebook.');}));
$('refresh').addEventListener('click',()=>task(async()=>{await api('posts');status('Đã tải lại danh sách.');}));
$('download').addEventListener('click',()=>task(async()=>{await api('download',{ids:posts.filter(p=>selected.has(p.id)).map(p=>p.id)});status('Đã xử lý tải xuống. Kiểm tra trạng thái từng bài và thư mục data/media.');}));
$('all').addEventListener('change',()=>{selected.clear();if($('all').checked)posts.forEach(p=>selected.add(p.id));render();});
$('rights').addEventListener('change',controls);
$('publish').addEventListener('click',()=>{
  const chosen=posts.filter(p=>selected.has(p.id));
  if(chosen.some(p=>p.state!=='downloaded'))return status('Chỉ chọn bài đã tải và chưa đăng. Bỏ chọn các bài có trạng thái khác.');
  if(!confirm('Đăng ngay '+chosen.length+' bài lên '+$('target').textContent+'? Đây là thao tác đăng thật.'))return;
  task(async()=>{await api('publish',{ids:chosen.map(p=>p.id),confirm:true,rights_confirmed:$('rights').checked});status('Đã xử lý hàng đợi. Kiểm tra trạng thái từng bài; bài chưa rõ kết quả cần đối chiếu trên Facebook.');});
});
$('export').addEventListener('click',()=>{
  const data=posts.filter(p=>!selected.size||selected.has(p.id));
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='facebook-posts.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
chrome.storage.session.get('pairingKey').then(data=>{if(data.pairingKey)$('key').value=data.pairingKey;});
controls();
