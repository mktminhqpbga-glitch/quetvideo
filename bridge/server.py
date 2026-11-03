"""Local-only authenticated bridge for the Chrome extension."""
import hmac
import json
import os
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from .service import Service
from .connectors import UserError


def main():
    service = Service(os.environ.get('FB_DATA_DIR', 'data'))
    key = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Do not log credentials, source content or request bodies.

        def reply(self, code, data):
            body = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            origin = self.headers.get('Origin', '')
            if origin.startswith('chrome-extension://'):
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            if not self.headers.get('Origin', '').startswith('chrome-extension://'):
                return self.reply(403, {'error': 'Chỉ cho phép extension.'})
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.end_headers()

        def authorized(self):
            if self.headers.get('Host') != '127.0.0.1:8765':
                return False
            origin = self.headers.get('Origin', '')
            if origin and not origin.startswith('chrome-extension://'):
                return False
            return hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + key)

        def do_GET(self):
            if not self.authorized():
                return self.reply(401, {'error': 'Mã ghép nối không đúng. Xem terminal bridge.'})
            if self.path == '/api/posts':
                return self.reply(200, {'posts': service.posts()})
            if self.path == '/api/status':
                return self.reply(200, {
                    'target_page': os.environ.get('FB_TARGET_PAGE_ID', ''),
                    'token_configured': bool(os.environ.get('FB_PAGE_ACCESS_TOKEN')),
                    'graph_version': os.environ.get('FB_GRAPH_VERSION', ''),
                })
            self.reply(404, {'error': 'Không tìm thấy.'})

        def do_POST(self):
            if not self.authorized():
                return self.reply(401, {'error': 'Mã ghép nối không đúng.'})
            try:
                if self.headers.get_content_type() != 'application/json':
                    raise ValueError('Chỉ chấp nhận JSON.')
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 100000:
                    raise ValueError('Request quá lớn hoặc rỗng.')
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError('JSON phải là object.')
                if self.path not in ('/api/scan', '/api/download', '/api/publish'):
                    return self.reply(404, {'error': 'Không tìm thấy.'})
                result = service.run(self.path.removeprefix('/api/'), body)
                self.reply(200, result)
            except (ValueError, TypeError, AttributeError) as exc:
                # Only our validation errors are safe to show; upstream messages are not.
                message = str(exc) if isinstance(exc, UserError) else service.error(exc)
                self.reply(400, {'error': message})
            except Exception as exc:
                self.reply(502, {'error': service.error(exc), 'posts': service.posts()})

    print('Bridge: http://127.0.0.1:8765', flush=True)
    print('Mã ghép nối extension (chỉ dùng trên máy bạn): ' + key, flush=True)
    print('Page đích: ' + (os.environ.get('FB_TARGET_PAGE_ID') or 'chưa cấu hình'), flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()


if __name__ == '__main__':
    main()
