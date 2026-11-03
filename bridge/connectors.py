"""Adapters for upstream packages. Credentials stay in the local Python process."""
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path


class UserError(ValueError):
    """A deliberately safe, user-facing validation message."""


def page_name(value):
    value = value.strip().rstrip('/')
    if value.startswith('https://'):
        parsed = urllib.parse.urlsplit(value)
        if parsed.hostname not in ('facebook.com', 'www.facebook.com') or parsed.query:
            raise UserError('Dùng tên Page hoặc URL https://www.facebook.com/tenpage không có query.')
        value = parsed.path.strip('/')
    if not re.fullmatch(r'[A-Za-z0-9.\-]{1,120}', value):
        raise UserError('Tên Page không hợp lệ; không nhập URL bài viết hay profile.php.')
    return value


def scan(source, pages):
    from facebook_scraper import get_posts
    kwargs = {'pages': pages, 'options': {'allow_extra_requests': True}}
    if os.environ.get('FB_COOKIES_FILE'):
        kwargs['cookies'] = os.environ['FB_COOKIES_FILE']
    # This package scans accessible feed pages, never guarantees full history.
    for post in get_posts(page_name(source), **kwargs):
        if not post.get('post_id'):
            continue
        time = post.get('time')
        yield {
            'source_id': str(post['post_id']),
            'url': str(post.get('post_url') or ''),
            'text': str(post.get('post_text') or post.get('text') or ''),
            'time': time.isoformat() if hasattr(time, 'isoformat') else str(time or ''),
            'images': list(dict.fromkeys(post.get('images') or ([post['image']] if post.get('image') else []))),
            'has_video': bool(post.get('video') or post.get('videos')),
        }


def media_url(url):
    p = urllib.parse.urlsplit(url)
    host = (p.hostname or '').lower()
    if p.scheme != 'https' or p.username or p.password or p.port not in (None, 443):
        raise UserError('Media phải dùng HTTPS.')
    if not any(host == h or host.endswith('.' + h) for h in ('fbcdn.net', 'fbsbx.com')):
        raise UserError('Chỉ tải ảnh từ CDN Facebook.')
    return url


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return super().redirect_request(req, fp, code, msg, headers, media_url(newurl))


def download(post, folder):
    """Download every supported attachment before allowing publication."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    if not post['text'].strip() and not post['images'] and not post['has_video']:
        raise UserError('Bài không có nội dung hỗ trợ; có thể là bài chia sẻ/link chưa được trích xuất.')
    if len(post['images']) > 10:
        raise UserError('Bài hơn 10 ảnh cần xử lý thủ công; chưa hỗ trợ tự đăng.')
    if post['has_video'] and post['images']:
        raise UserError('Bài có cả ảnh và video cần xử lý thủ công; chưa hỗ trợ tự đăng.')
    if post['has_video']:
        from yt_dlp import YoutubeDL
        parsed = urllib.parse.urlsplit(post['url'])
        if parsed.scheme != 'https' or parsed.hostname not in ('facebook.com', 'www.facebook.com', 'm.facebook.com'):
            raise UserError('URL video phải thuộc Facebook.')
        options = {
            'outtmpl': str(folder / 'video.%(ext)s'), 'noplaylist': True,
            'quiet': True, 'no_warnings': True, 'socket_timeout': 30,
            'max_filesize': 500 * 1024 * 1024,
            'format': 'best[ext=mp4]/best',
        }
        if os.environ.get('FB_COOKIES_FILE'):
            options['cookiefile'] = os.environ['FB_COOKIES_FILE']
        with YoutubeDL(options) as ydl:
            result = ydl.extract_info(post['url'], download=True)
            if result.get('_type') in ('playlist', 'multi_video') or result.get('entries'):
                raise UserError('Bài nhiều video cần xử lý thủ công.')
            path = Path(ydl.prepare_filename(result))
        if not path.is_file() or path.stat().st_size == 0:
            raise UserError('Video chưa tải xong hoặc vượt giới hạn 500MB.')
        return [{'kind': 'video', 'path': str(path.resolve())}]
    result = []
    opener = urllib.request.build_opener(SafeRedirect())
    for i, url in enumerate(post['images']):
        req = urllib.request.Request(media_url(url), headers={'User-Agent': 'Mozilla/5.0'})
        with opener.open(req, timeout=30) as response:
            mime = response.headers.get_content_type()
            extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}.get(mime)
            if not extension:
                raise UserError('Định dạng ảnh không được hỗ trợ: ' + mime)
            body = response.read(25 * 1024 * 1024 + 1)
        if not body or len(body) > 25 * 1024 * 1024:
            raise UserError('Ảnh rỗng hoặc lớn hơn 25MB.')
        path = folder / f'image-{i}.{extension}'
        path.write_bytes(body)
        result.append({'kind': 'photo', 'path': str(path.resolve())})
    return result


def publish(post, attachments):
    from facebook_business.api import FacebookAdsApi
    from facebook_business.session import FacebookSession
    token, target, version = (os.environ.get(k, '') for k in ('FB_PAGE_ACCESS_TOKEN', 'FB_TARGET_PAGE_ID', 'FB_GRAPH_VERSION'))
    if not token or not target.isdigit() or not re.fullmatch(r'v\d+\.\d+', version):
        raise UserError('Cấu hình FB_PAGE_ACCESS_TOKEN, FB_TARGET_PAGE_ID và FB_GRAPH_VERSION trước khi đăng.')
    # Explicit per-instance API avoids global SDK credential state.
    api = FacebookAdsApi(FacebookSession(access_token=token, timeout=120), api_version=version)
    text = post['text']
    if not attachments:
        return api.call('POST', (target, 'feed'), params={'message': text}).json()
    if attachments[0]['kind'] == 'video':
        if len(attachments) != 1:
            raise UserError('Chỉ hỗ trợ một video mỗi bài.')
        with open(attachments[0]['path'], 'rb') as source:
            return api.call('POST', (target, 'videos'), params={'description': text}, files={'source': source}).json()
    media = []
    for attachment in attachments:
        with open(attachment['path'], 'rb') as source:
            photo = api.call('POST', (target, 'photos'), params={'published': False}, files={'source': source}).json()
        media.append({'media_fbid': photo['id']})
    return api.call('POST', (target, 'feed'), params={'message': text, 'attached_media': media}).json()
