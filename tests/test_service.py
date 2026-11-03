import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from bridge.service import Service
from bridge import connectors


ENV = {'FB_TARGET_PAGE_ID': '123456', 'FB_PAGE_ACCESS_TOKEN': 'test-token', 'FB_GRAPH_VERSION': 'v26.0'}


class WorkflowTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.service = Service(self.tmp.name)
        self.post = {'source_id': '101', 'url': 'https://www.facebook.com/posts/101', 'text': 'Nội dung thử', 'time': '2026-01-01', 'images': [], 'has_video': False}
        with patch.object(connectors, 'scan', return_value=iter([self.post])):
            self.service.run('scan', {'source': 'example', 'pages': 3})
        self.ids = ['101']

    def download(self):
        return self.service.run('download', {'ids': self.ids})

    def publish(self):
        return self.service.run('publish', {'ids': self.ids, 'confirm': True, 'rights_confirmed': True})

    def test_scan_deduplicates_preserves_download_state(self):
        self.download()
        with patch.object(connectors, 'scan', return_value=iter([self.post])):
            result = self.service.run('scan', {'source': 'example', 'pages': 3})
        self.assertEqual(result['added'], 0)
        self.assertEqual(result['posts'][0]['state'], 'downloaded')
        self.assertEqual(len(list(Path(self.tmp.name).glob('media/*/post.json'))), 1)

    @patch.dict(os.environ, ENV)
    def test_confirmation_and_download_required_before_any_api_call(self):
        with patch.object(connectors, 'publish') as upstream:
            with self.assertRaises(ValueError):
                self.service.run('publish', {'ids': self.ids, 'confirm': True})
            with self.assertRaises(ValueError):
                self.publish()
            upstream.assert_not_called()

    @patch.dict(os.environ, ENV)
    def test_publish_once_then_reject_duplicates(self):
        self.download()
        with patch.object(connectors, 'publish', return_value={'id': '123_456'}) as upstream:
            result = self.publish()
            self.assertEqual(result['posts'][0]['state'], 'published')
            with self.assertRaises(ValueError):
                self.publish()
            upstream.assert_called_once()

    @patch.dict(os.environ, ENV)
    def test_timeout_uncertain_no_retry_and_no_credential_leak(self):
        self.download()
        with patch.object(connectors, 'publish', side_effect=TimeoutError('token=test-secret')):
            result = self.publish()
        self.assertEqual(result['posts'][0]['state'], 'uncertain')
        self.assertNotIn('test-secret', json.dumps(result))
        with patch.object(connectors, 'publish') as upstream:
            with self.assertRaises(ValueError):
                self.publish()
            upstream.assert_not_called()

    def test_crash_during_publish_is_not_retryable(self):
        with self.service.db() as db:
            db.execute("UPDATE posts SET state='publishing'")
        restored = Service(self.tmp.name)
        self.assertEqual(restored.posts()[0]['state'], 'uncertain')

    @patch.dict(os.environ, ENV)
    def test_missing_media_blocks_entire_batch(self):
        self.download()
        with self.service.db() as db:
            db.execute('UPDATE posts SET media=?', (json.dumps([{'kind': 'photo', 'path': '/missing/photo.jpg'}]),))
        with patch.object(connectors, 'publish') as upstream:
            with self.assertRaises(ValueError):
                self.publish()
            upstream.assert_not_called()

    def test_media_and_page_url_validation(self):
        for value in ['http://localhost/x', 'https://evil.example/x', 'https://facebook.com.evil.example/x']:
            with self.assertRaises(ValueError):
                connectors.page_name(value)
        for value in ['https://127.0.0.1/x', 'http://x.fbcdn.net/y', 'https://fbcdn.net.evil.test/x']:
            with self.assertRaises(ValueError):
                connectors.media_url(value)
        self.assertEqual(connectors.page_name('https://www.facebook.com/example'), 'example')
        self.assertEqual(connectors.media_url('https://scontent.fbcdn.net/a'), 'https://scontent.fbcdn.net/a')

    def test_download_failure_never_marks_post_ready(self):
        with patch.object(connectors, 'download', side_effect=OSError('cookie=private')):
            result = self.download()
        self.assertEqual(result['posts'][0]['state'], 'download_failed')
        self.assertNotIn('private', result['posts'][0]['error'])

    def test_empty_and_unsupported_posts_do_not_silently_lose_media(self):
        for post in [dict(self.post, text=''),dict(self.post,images=['a']*11),dict(self.post,images=['a'],has_video=True)]:
            with self.assertRaises(ValueError):
                connectors.download(post, Path(self.tmp.name)/'unsupported')

    @patch.dict(os.environ, ENV)
    def test_sdk_photo_upload_is_multipart_then_feed(self):
        photo = Path(self.tmp.name)/'photo.jpg'
        photo.write_bytes(b'photo-body')
        calls = []
        def call(method, path, params=None, files=None):
            calls.append((method,path,params))
            if files:
                self.assertEqual(files['source'].read(), b'photo-body')
            response = Mock()
            response.json.return_value = {'id':'photo123' if path[-1]=='photos' else 'post123'}
            return response
        with patch('facebook_business.api.FacebookAdsApi.call', side_effect=call):
            result = connectors.publish(self.post, [{'kind':'photo','path':str(photo)}])
        self.assertEqual(result['id'], 'post123')
        self.assertEqual(calls[0][1], ('123456','photos'))
        self.assertEqual(calls[1][2]['attached_media'], [{'media_fbid':'photo123'}])

    @patch.dict(os.environ, ENV)
    def test_sdk_video_upload_sends_binary_file(self):
        video = Path(self.tmp.name)/'video.mp4'
        video.write_bytes(b'video-body')
        def call(method,path,params=None,files=None):
            self.assertEqual(path, ('123456','videos'))
            self.assertEqual(files['source'].read(),b'video-body')
            response=Mock();response.json.return_value={'id':'video123'};return response
        with patch('facebook_business.api.FacebookAdsApi.call',side_effect=call):
            self.assertEqual(connectors.publish(self.post,[{'kind':'video','path':str(video)}])['id'],'video123')


if __name__ == '__main__':
    unittest.main()
