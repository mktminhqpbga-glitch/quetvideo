import json
import os
import sqlite3
import threading
from pathlib import Path
from . import connectors


class Service:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        with self.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, media TEXT NOT NULL DEFAULT "[]", state TEXT NOT NULL DEFAULT "scanned", result TEXT, error TEXT)')
            # A crash mid-request must never cause an automatic duplicate post.
            db.execute("UPDATE posts SET state='uncertain', error='Bridge dừng khi đang đăng; kiểm tra Page trước khi xử lý thủ công.' WHERE state='publishing'")

    def db(self):
        return sqlite3.connect(self.root / 'queue.sqlite3')

    def posts(self):
        with self.db() as db:
            return [dict(json.loads(p), id=i, state=s, error=e, result=json.loads(r) if r else None,
                         attachments=[{'kind': a['kind'], 'name': Path(a['path']).name} for a in json.loads(m)])
                    for i, p, m, s, r, e in db.execute('SELECT * FROM posts ORDER BY json_extract(payload,"$.time"), id')]

    def run(self, action, body):
        if not self.lock.acquire(blocking=False):
            raise connectors.UserError('Đang xử lý một tác vụ khác. Chờ hoàn tất rồi tải lại danh sách.')
        try:
            if action == 'scan':
                pages = body.get('pages', 3)
                if type(pages) is not int or not 1 <= pages <= 100:
                    raise connectors.UserError('Số trang quét phải từ 1 đến 100.')
                source = connectors.page_name(body.get('source', ''))
                count = 0
                for post in connectors.scan(source, pages):
                    identifier = str(post['source_id'])
                    post = dict(post, source_page=source)
                    with self.db() as db:
                        count += db.execute('INSERT OR IGNORE INTO posts(id,payload) VALUES (?,?)', (identifier, json.dumps(post))).rowcount
                return {'added': count, 'posts': self.posts()}
            ids = body.get('ids')
            if not isinstance(ids, list) or not 1 <= len(ids) <= 100 or any(not isinstance(i, str) for i in ids) or len(set(ids)) != len(ids):
                raise connectors.UserError('Chọn từ 1 đến 100 bài, không trùng nhau.')
            if action not in ('download', 'publish'):
                raise connectors.UserError('Thao tác không hợp lệ.')
            if action == 'publish':
                if body.get('confirm') is not True or body.get('rights_confirmed') is not True:
                    raise connectors.UserError('Cần xác nhận quyền nội dung và việc đăng bài.')
                if not all(os.environ.get(k) for k in ('FB_TARGET_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN', 'FB_GRAPH_VERSION')):
                    raise connectors.UserError('Chưa cấu hình Page đích, access token hoặc phiên bản Graph API trong bridge.')
            with self.db() as db:
                rows = {r[0]: r for r in db.execute('SELECT * FROM posts')}
            if any(i not in rows for i in ids):
                raise connectors.UserError('Có bài không tồn tại.')
            # Preflight the entire selection before any external publication.
            if action == 'publish':
                for i in ids:
                    row = rows[i]
                    if row[3] != 'downloaded':
                        raise connectors.UserError('Chỉ đăng bài đã tải và chưa đăng. Bài uncertain cần đối chiếu thủ công.')
                    if any(not Path(a['path']).is_file() for a in json.loads(row[2])):
                        raise connectors.UserError('Thiếu media đã tải; chưa đăng bài nào.')
            for identifier in ids:
                _, payload, media, state, _, _ = rows[identifier]
                post = json.loads(payload)
                if action == 'download':
                    if state in ('published', 'publishing', 'uncertain'):
                        continue
                    try:
                        import hashlib
                        folder = self.root / 'media' / hashlib.sha256(identifier.encode()).hexdigest()
                        attachments = connectors.download(post, folder)
                        (folder / 'post.json').write_text(json.dumps(post, ensure_ascii=False, indent=2))
                        with self.db() as db:
                            db.execute("UPDATE posts SET media=?,state='downloaded',error=NULL WHERE id=?", (json.dumps(attachments), identifier))
                    except Exception as exc:
                        with self.db() as db:
                            db.execute("UPDATE posts SET state='download_failed',error=? WHERE id=?", (self.error(exc), identifier))
                    continue
                with self.db() as db:
                    db.execute("UPDATE posts SET state='publishing',error=NULL WHERE id=?", (identifier,))
                try:
                    result = connectors.publish(post, json.loads(media))
                    if not isinstance(result, dict) or not result.get('id'):
                        raise connectors.UserError('API chưa trả mã bài; kiểm tra Page trước khi xử lý thủ công.')
                    result = dict(result, target_page=os.environ['FB_TARGET_PAGE_ID'])
                    with self.db() as db:
                        db.execute("UPDATE posts SET state='published',result=? WHERE id=?", (json.dumps(result), identifier))
                except Exception as exc:
                    with self.db() as db:
                        db.execute("UPDATE posts SET state='uncertain',error=? WHERE id=?", (self.error(exc), identifier))
                    # Stop queue: upstream may have accepted a request before timeout.
                    break
            return {'posts': self.posts()}
        finally:
            self.lock.release()

    @staticmethod
    def error(exc):
        # Third-party exception messages may contain cookie/token request details.
        if isinstance(exc, connectors.UserError):
            return str(exc)
        return type(exc).__name__ + ': tác vụ thất bại; kiểm tra cấu hình, quyền truy cập hoặc media. Không tự thử lại thao tác đăng.'
