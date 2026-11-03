/* Shared validation for messages originating from the Facebook DOM. */
globalThis.qvCore = {
  facebookUrl(value) {
    try { const u=new URL(value);return u.protocol==='https:'&&/(^|\.)facebook\.com$/.test(u.hostname)&&!u.username&&!u.password?u.href:null; } catch {return null;}
  },
  mediaUrl(value) {
    try { const u=new URL(value);return u.protocol==='https:'&&/(^|\.)(fbcdn\.net|fbsbx\.com)$/.test(u.hostname)&&!u.username&&!u.password&&u.port===''&&value.length<=5000?u.href:null; } catch {return null;}
  },
  cleanPost(post) {
    if(!post||typeof post.id!=='string'||!/^[A-Za-z0-9._-]{1,180}$/.test(post.id))return null;
    const url=this.facebookUrl(post.url);if(!url)return null;
    return {id:post.id,url,text:String(post.text||'').slice(0,12000),
      images:[...new Set((Array.isArray(post.images)?post.images:[]).map(x=>this.mediaUrl(x)).filter(Boolean))].slice(0,10),
      videos:[...new Set((Array.isArray(post.videos)?post.videos:[]).map(x=>this.mediaUrl(x)).filter(Boolean))].slice(0,1),
      videoNeedsManual:post.videoNeedsManual===true,sourcePage:this.facebookUrl(post.sourcePage)||'',
      time:String(post.time||'').slice(0,100),scannedAt:new Date().toISOString()};
  },
  merge(before,incoming) {
    const map=new Map(before.map(p=>[p.id,p]));
    for(const raw of incoming){const post=this.cleanPost(raw);if(!post)continue;
      const old=map.get(post.id);
      if(old){post.text=post.text.length>=old.text.length?post.text:old.text;
        post.images=[...new Set([...old.images,...post.images])].slice(0,10);
        post.videos=[...new Set([...old.videos,...post.videos])].slice(0,1);
        post.videoNeedsManual=post.videoNeedsManual||old.videoNeedsManual;
      }map.set(post.id,post);
    }
    if(map.size>2000)throw Error('Đã đạt 2.000 bài lưu cục bộ. Xuất JSON và tải media trước khi xóa danh sách để quét đợt mới.');
    const result=[...map.values()];
    if(new TextEncoder().encode(JSON.stringify(result)).length>8*1024*1024)throw Error('Danh sách gần đầy bộ nhớ. Xuất JSON và tải media rồi xóa danh sách để tiếp tục.');
    return result;
  }
};
