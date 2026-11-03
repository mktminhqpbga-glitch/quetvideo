"""Fail before asking for configuration when the runtime is incomplete."""
import importlib
import sys


def check_runtime():
    if sys.version_info < (3, 10):
        raise SystemExit(
            'Cần Python 3.10 trở lên (khuyên dùng 3.12). '
            'Cài Python 3.12 từ python.org, tạo môi trường mới bằng '
            'python3.12 -m venv .venv312 rồi dùng .venv312/bin/python.'
        )
    missing = []
    for module in ('facebook_scraper', 'yt_dlp', 'facebook_business', 'lxml_html_clean'):
        try:
            importlib.import_module(module)
        except ImportError:
            missing.append(module)
    if missing:
        raise SystemExit(
            'Chưa cài đủ thư viện: ' + ', '.join(missing) + '.\n'
            'Trong thư mục quetvideo, chạy bằng Python của môi trường ảo:\n'
            'python -m pip install --upgrade pip\n'
            'python -m pip install -r requirements.txt\n'
            'Sau khi cài thành công, chạy lại run.py.'
        )
