"""Synthetic-only server for UI tests. Never use this launcher with a real Page."""
import os
import tempfile
from bridge import connectors
from bridge.server import main

os.environ['FB_DATA_DIR'] = tempfile.mkdtemp(prefix='fb-ui-test-')
os.environ['FB_TARGET_PAGE_ID'] = '123456'
os.environ['FB_GRAPH_VERSION'] = 'v26.0'
os.environ['FB_PAGE_ACCESS_TOKEN'] = 'synthetic-test-only'
connectors.scan = lambda source, pages: iter([
    {'source_id':'101','url':'https://www.facebook.com/test/posts/101','text':'Bài viết thử <script>không thực thi</script>','time':'2026-01-01','images':[],'has_video':False},
    {'source_id':'102','url':'https://www.facebook.com/test/posts/102','text':'Bài thứ hai','time':'2026-01-02','images':[],'has_video':False},
])
connectors.publish = lambda post, attachments: {'id':'123456_'+post['source_id']}
main()
