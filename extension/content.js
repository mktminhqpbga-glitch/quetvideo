/* Runs in Chrome's isolated content-script world, never reads login cookies. */
(() => {
  if (globalThis.__quetvideoInstalled) return;
  globalThis.__quetvideoInstalled = true;
  let running = false, cancelled = false;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function canonicalPost(value) {
    try {
      const u = new URL(value, location.href);
      if (u.protocol !== 'https:' || !/(^|\.)facebook\.com$/.test(u.hostname)) return null;
      if (u.searchParams.has('comment_id') || u.searchParams.has('reply_comment_id')) return null;
      const match = u.pathname.match(/\/(?:posts|videos|reel)\/([A-Za-z0-9._-]+)/);
      let id = match?.[1];
      if (!id && /\/(?:permalink|story)\.php$/.test(u.pathname)) id = u.searchParams.get('story_fbid');
      if (!id && u.pathname === '/watch/') id = u.searchParams.get('v');
      if (!id || !/^[A-Za-z0-9._-]{1,180}$/.test(id)) return null;
      const clean = new URL(u.origin + u.pathname);
      for (const key of ['story_fbid','id','v']) if (u.searchParams.has(key)) clean.searchParams.set(key,u.searchParams.get(key));
      return {id, url: clean.href};
    } catch { return null; }
  }
  function mediaUrl(value) {
    try { const u=new URL(value);return u.protocol==='https:' && /(^|\.)(fbcdn\.net|fbsbx\.com)$/.test(u.hostname) && value.length<=5000 ? u.href:null; } catch {return null;}
  }
  const skipText = /^(Thích|Bình luận|Chia sẻ|Like|Comment|Share|Gửi|Send|Xem thêm|See more|Viết bình luận.*|Write a comment.*)$/i;
  function extract(article) {
    const link = [...article.querySelectorAll('a[href]')].map(a=>({a,post:canonicalPost(a.href)})).filter(x=>x.post)
      .sort((a,b)=>Number(!!b.a.querySelector('time,abbr'))-Number(!!a.a.querySelector('time,abbr')))[0];
    if (!link) return null;
    const messages=[...article.querySelectorAll('[data-ad-preview="message"], [data-ad-comet-preview="message"]')];
    let text;
    if (messages.length) text=messages.map(e=>e.innerText.trim()).filter(Boolean).join('\n');
    else {
      const candidates=[...article.querySelectorAll('div[dir="auto"]')].filter(e=>!e.closest('[role="button"], [role="comment"]')&&!e.querySelector('div[dir="auto"]'));
      text=[...new Set(candidates.map(e=>e.innerText.trim()).filter(t=>t&&!skipText.test(t)))].join('\n');
    }
    const images=[...new Set([...article.querySelectorAll('img')].filter(img=>{
      const r=img.getBoundingClientRect();
      return (r.width>=160&&r.height>=100) && !/profile picture|ảnh đại diện/i.test(img.alt||'');
    }).map(img=>mediaUrl(img.currentSrc||img.src)).filter(Boolean))].slice(0,10);
    const videos=[...article.querySelectorAll('video')];
    const directVideos=[...new Set(videos.map(v=>mediaUrl(v.currentSrc||v.src||v.querySelector('source')?.src)).filter(Boolean))].slice(0,1);
    return {...link.post,text:text.slice(0,12000),images,videos:directVideos,
      videoNeedsManual:videos.some(v=>!mediaUrl(v.currentSrc||v.src||v.querySelector('source')?.src)) || (!directVideos.length && /\/(videos|reel)\//.test(link.post.url)),
      sourcePage:location.href,time:article.querySelector('time')?.dateTime||'',scannedAt:new Date().toISOString()};
  }
  async function scan(config) {
    running=true;cancelled=false;
    const seen=new Map();let idle=0,reason='Đã dừng theo yêu cầu.';
    try {
      while (!cancelled) {
        const roots=[...document.querySelectorAll('[role="feed"] [role="article"], [data-pagelet^="FeedUnit"]')];
        const articles=(roots.length?roots:[...document.querySelectorAll('[role="article"]')]).filter(e=>!e.parentElement?.closest('[role="article"]'));
        for(const article of articles) {
          for(const button of article.querySelectorAll('[role="button"]')) {
            if(/^(Xem thêm|See more)$/i.test(button.textContent.trim()) && !button.closest('a[href]'))button.click();
          }
        }
        await pause(350);
        const changed=[];let newCount=0;
        for (const article of articles) {
          const post=extract(article);if(!post)continue;
          if(!seen.has(post.id)){if(seen.size>=config.limit)break;newCount++;}
          const signature=JSON.stringify([post.text,post.images,post.videos,post.videoNeedsManual]);
          if(seen.get(post.id)!==signature){seen.set(post.id,signature);changed.push(post);}
        }
        const response=await chrome.runtime.sendMessage({type:'qv:batch',session:config.session,posts:changed,count:seen.size});
        if(!response?.ok)throw Error(response?.error||'Extension không lưu được kết quả.');
        if(seen.size>=config.limit){reason='Đã đạt số bài tối đa của đợt quét.';break;}
        idle=newCount?0:idle+1;
        if(idle>=8){reason='Không tìm thấy bài mới sau 8 lần cuộn. Có thể Facebook chưa tải thêm hoặc cấu trúc trang không được nhận diện; chưa xác nhận hết lịch sử.';break;}
        window.scrollBy({top:Math.max(innerHeight*0.85,600),behavior:'instant'});
        for(let i=0;i<8&&!cancelled;i++)await pause(300);
      }
      await chrome.runtime.sendMessage({type:'qv:done',session:config.session,reason,count:seen.size});
    } catch(error) {
      await chrome.runtime.sendMessage({type:'qv:done',session:config.session,reason:'Quét dừng: '+error.message,count:seen.size}).catch(()=>{});
    } finally {running=false;}
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message.type==='qv:ping'){reply({ok:true,running});}
    else if(message.type==='qv:start'){
      if(running){reply({ok:false,error:'Tab này đang quét. Bấm Dừng và chờ hoàn tất trước khi quét lại.'});return;}
      reply({ok:true});void scan(message);
    }else if(message.type==='qv:stop'){cancelled=true;reply({ok:true});}
  });
})();
