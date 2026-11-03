/* Chrome isolated world: reads rendered DOM only, never login cookies. */
(() => {
  const VERSION='0.2.1';
  if(globalThis.__quetvideoVersion===VERSION)return;
  globalThis.__quetvideoStop?.();
  globalThis.__quetvideoVersion=VERSION;
  let running=false,cancelled=false,obsolete=false;
  globalThis.__quetvideoStop=()=>{cancelled=true;obsolete=true;};
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const selector='[role="article"], [data-pagelet*="FeedUnit"], .story_body_container, [data-sigil~="story-div"]';
  function canonicalPost(value){
    try{
      const u=new URL(value,location.href);
      if(u.protocol!=='https:'||!/(^|\.)facebook\.com$/.test(u.hostname)||u.searchParams.has('comment_id')||u.searchParams.has('reply_comment_id'))return null;
      const match=u.pathname.match(/\/(posts|videos|reels?|share\/[pvr])\/([A-Za-z0-9._-]+)/);
      let id=match?.[2];if(match?.[1].startsWith('share/'))id='share_'+match[1].slice(-1)+'_'+id;
      if(!id)id=u.searchParams.get('story_fbid');
      if(!id&&/^\/watch\/?$/.test(u.pathname))id=u.searchParams.get('v');
      if(!id||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,179}$/.test(id))return null;
      const clean=new URL(u.origin+u.pathname);
      for(const key of ['story_fbid','id','v'])if(u.searchParams.has(key))clean.searchParams.set(key,u.searchParams.get(key));
      return {id,url:clean.href};
    }catch{return null;}
  }
  function mediaUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&/(^|\.)(fbcdn\.net|fbsbx\.com)$/.test(u.hostname)&&value.length<=5000?u.href:null;}catch{return null;}}
  function sourceUrl(){
    const original=new URL(location.href),clean=new URL(original.origin+original.pathname);
    if(original.pathname==='/profile.php'&&original.searchParams.has('id'))clean.searchParams.set('id',original.searchParams.get('id'));
    return clean.href;
  }
  function fingerprint(text,images){
    const s=sourceUrl()+'\n'+text+'\n'+images.map(x=>x.split('?')[0]).join('\n');let a=2166136261,b=2246822519;
    for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b^s.charCodeAt(i),3266489917);}
    return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
  }
  function linkScore(a){return (a.querySelector('time,abbr,[data-utime]')?10:0)+(/\/(posts|videos)\//.test(a.href)?2:0);}
  function anchorContainer(a){
    const preferred=a.closest(selector);if(preferred)return preferred;
    // Reels/video grids and alternate Page layouts often have no role=article.
    let node=a.parentElement;
    for(let depth=0;node&&depth<9;depth++,node=node.parentElement){
      if(node.matches('[role="feed"], [role="main"], main,body,html'))break;
      const links=new Set([...node.querySelectorAll('a[href]')].map(x=>canonicalPost(x.href)?.id).filter(Boolean));
      if(links.size>1)break;
      if(node.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"], video, img')&&node.getBoundingClientRect().height>=100)return node;
    }
    return null;
  }
  function candidates(){
    const nodes=new Set();
    // Prefer the closest card per permalink rather than discarding every nested article.
    for(const a of document.querySelectorAll('a[href]'))if(canonicalPost(a.href)){const card=anchorContainer(a);if(card)nodes.add(card);}
    for(const node of document.querySelectorAll(selector)){
      if(node.closest('[role="comment"]'))continue;
      // A wrapper containing several actual cards is not itself a post.
      const nested=[...node.querySelectorAll(selector)].filter(x=>x!==node&&!x.closest('[role="comment"]'));
      const ownMessage=[...node.querySelectorAll('[data-ad-preview="message"], [data-ad-comet-preview="message"]')].some(m=>m.closest(selector)===node);
      if(nested.length&&!ownMessage)continue;
      if(node.getBoundingClientRect().height>0)nodes.add(node);
    }
    return [...nodes];
  }
  const skip=/^(Thích|Bình luận|Chia sẻ|Like|Comment|Share|Gửi|Send|Xem thêm|See more|Viết bình luận.*|Write a comment.*)$/i;
  function extract(card){
    const links=[...card.querySelectorAll('a[href]')].map(a=>({a,post:canonicalPost(a.href)})).filter(x=>x.post).sort((a,b)=>linkScore(b.a)-linkScore(a.a));
    const messages=[...card.querySelectorAll('[data-ad-preview="message"], [data-ad-comet-preview="message"]')];
    let text;
    if(messages.length)text=messages.map(e=>e.innerText.trim()).filter(Boolean).join('\n');
    else text=[...new Set([...card.querySelectorAll('div[dir="auto"]')].filter(e=>!e.closest('[role="button"], [role="comment"]')&&!e.querySelector('div[dir="auto"]')).map(e=>e.innerText.trim()).filter(t=>t&&!skip.test(t)))].join('\n');
    text=text.slice(0,12000);
    const images=[...new Set([...card.querySelectorAll('img')].filter(img=>{const r=img.getBoundingClientRect();return r.width>=160&&r.height>=100&&!/profile picture|ảnh đại diện/i.test(img.alt||'');}).map(img=>mediaUrl(img.currentSrc||img.src)).filter(Boolean))].slice(0,10);
    const videos=[...card.querySelectorAll('video')],directVideos=[...new Set(videos.map(v=>mediaUrl(v.currentSrc||v.src||v.querySelector('source')?.src)).filter(Boolean))].slice(0,1);
    const fp=fingerprint(text,images),link=links[0]?.post;
    // Keep useful visible content even if Facebook has not hydrated its permalink.
    if(!link&&text.length<15&&!images.length&&!videos.length)return null;
    return {...(link||{id:'dom_'+fp,url:sourceUrl()}),permalinkFound:!!link,fingerprint:fp,text,images,videos:directVideos,
      videoNeedsManual:videos.some(v=>!mediaUrl(v.currentSrc||v.src||v.querySelector('source')?.src))||(!directVideos.length&&/\/(videos|reels?|watch)(\/|\?)/.test(link?.url||'')),
      sourcePage:sourceUrl(),time:card.querySelector('time')?.dateTime||'',scannedAt:new Date().toISOString()};
  }
  function scroller(cards){
    for(const card of cards){let node=card.parentElement;while(node&&node!==document.body){if(/auto|scroll/.test(getComputedStyle(node).overflowY)&&node.scrollHeight>node.clientHeight+100)return node;node=node.parentElement;}}
    return document.scrollingElement||document.documentElement;
  }
  async function hydrate(cards){
    for(const card of cards){
      for(const button of card.querySelectorAll('[role="button"]'))if(/^(Xem thêm|See more)$/i.test(button.textContent.trim())&&!button.closest('a[href]'))button.click();
      for(const a of card.querySelectorAll('a[href]')){
        if(!canonicalPost(a.href)&&(a.querySelector('time,abbr,[data-utime]')||/\d+\s*(phút|giờ|ngày|minutes?|hours?|days?)/i.test(a.getAttribute('aria-label')||''))){
          a.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));a.dispatchEvent(new MouseEvent('mouseenter',{bubbles:false}));
        }
      }
    }
  }
  async function scan(config){
    running=true;cancelled=false;const seen=new Map(),provisional=new Map(),realFingerprints=new Set();let idle=0,reason='Đã dừng theo yêu cầu.',diagnostics={round:0};const started=Date.now();
    try{
      while(!cancelled&&!obsolete){
        let cards=candidates();await hydrate(cards);await pause(350);cards=candidates();
        const changed=[];let newCount=0;
        for(const card of cards){const post=extract(card);if(!post)continue;
          if(post.permalinkFound){realFingerprints.add(post.fingerprint);const previous=provisional.get(post.fingerprint);if(previous){seen.delete(previous);provisional.delete(post.fingerprint);}}
          else{if(realFingerprints.has(post.fingerprint))continue;provisional.set(post.fingerprint,post.id);}
          if(!seen.has(post.id)){if(seen.size>=config.limit)break;newCount++;}
          const signature=JSON.stringify([post.text,post.images,post.videos,post.permalinkFound]);
          if(seen.get(post.id)!==signature){seen.set(post.id,signature);changed.push(post);}
        }
        const target=scroller(cards);
        diagnostics={round:diagnostics.round+1,articleCandidates:cards.length,postLinks:[...document.querySelectorAll('a[href]')].filter(a=>canonicalPost(a.href)).length,
          elapsedSeconds:Math.round((Date.now()-started)/1000),scrollTop:Math.round(target.scrollTop),scrollHeight:target.scrollHeight,viewportHeight:target.clientHeight,innerScroll:target!==document.scrollingElement};
        const response=await chrome.runtime.sendMessage({type:'qv:batch',session:config.session,posts:changed,count:seen.size,diagnostics});
        if(!response?.ok)throw Error(response?.error||'Extension không lưu được kết quả.');
        if(seen.size>=config.limit){reason='Đã đạt số bài tối đa của đợt quét.';break;}
        idle=newCount?0:idle+1;
        if(idle>=8){reason=seen.size?'Không thấy bài mới sau 8 lần cuộn. Chưa xác nhận hết lịch sử Page.':
          cards.length?'Có khối bài nhưng chưa đọc được nội dung. Mở mục Bài viết của Page; gửi dòng chẩn đoán và URL Page để kiểm tra.':'Chưa nhận diện được khối bài. Mở mục Bài viết của Page, đóng cửa sổ bật lên rồi thử lại; gửi URL Page và dòng chẩn đoán nếu vẫn 0 bài.';break;}
        const before=target.scrollTop;
        if(target===document.scrollingElement)window.scrollBy({top:Math.max(innerHeight*0.85,600),behavior:'instant'});
        else target.scrollTop+=Math.max(target.clientHeight*0.85,600);
        diagnostics.scrollMoved=target.scrollTop!==before;
        for(let i=0;i<8&&!cancelled&&!obsolete;i++)await pause(300);
      }
      await chrome.runtime.sendMessage({type:'qv:done',session:config.session,reason,count:seen.size,diagnostics});
    }catch(error){await chrome.runtime.sendMessage({type:'qv:done',session:config.session,reason:'Quét dừng: '+error.message,count:seen.size,diagnostics}).catch(()=>{});}
    finally{running=false;}
  }
  const listener=(message,sender,reply)=>{
    if(obsolete)return;
    if(message.type==='qv:ping')reply({ok:true,running,version:VERSION});
    else if(message.type==='qv:start'){if(running){reply({ok:false,error:'Tab này đang quét. Bấm Dừng và chờ hoàn tất trước khi quét lại.'});return;}reply({ok:true});void scan(message);}
    else if(message.type==='qv:stop'){cancelled=true;reply({ok:true});}
  };
  chrome.runtime.onMessage.addListener(listener);
})();
