"""Convenient local launcher; never stores the Facebook token on disk."""
import getpass
import os
from bridge.server import main

if __name__ == '__main__':
    print('Enter để bỏ qua cấu hình đăng: bạn vẫn có thể quét/tải bài.')
    if not os.environ.get('FB_TARGET_PAGE_ID'):
        target = input('ID số của Page đích (không phải URL): ').strip()
        if target:
            if not target.isdigit():
                raise SystemExit('Page ID phải là số.')
            os.environ['FB_TARGET_PAGE_ID'] = target
    if os.environ.get('FB_TARGET_PAGE_ID'):
        if not os.environ.get('FB_GRAPH_VERSION'):
            os.environ['FB_GRAPH_VERSION'] = input('Phiên bản Graph API đã bật trong Meta App (ví dụ v26.0): ').strip()
        if not os.environ.get('FB_PAGE_ACCESS_TOKEN'):
            os.environ['FB_PAGE_ACCESS_TOKEN'] = getpass.getpass('Page access token (ẩn khi nhập; Enter để bỏ qua): ').strip()
    main()
