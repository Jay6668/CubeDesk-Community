import http.client
import json
import tempfile
import unittest
from pathlib import Path
from cubedesk_community.app.server import start_server
from cubedesk_community.app.service import App

class NoRadio:
    def __init__(self,on_event):self.callback=on_event
    def snapshot(self):return dict(connected=False,connecting=False,error='',name='')
    def disconnect(self):self.callback(dict(kind='disconnect'))
    def close(self):pass

class ServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name);web=root/'web';web.mkdir();(web/'index.html').write_text('test')
        (root/'secret.txt').write_text('must not leak');(web/'.hidden').write_text('must not leak')
        self.app=App(root/'data',NoRadio);self.server=start_server(self.app,web);self.port=self.server.server_port
    def tearDown(self):self.server.shutdown();self.server.server_close();self.app.close();self.tmp.cleanup()
    def request(self,method,path,body=None,headers=None):
        c=http.client.HTTPConnection('127.0.0.1',self.port,timeout=3);c.request(method,path,body,headers or {});r=c.getresponse();data=r.read();status=r.status;c.close();return status,data
    def test_path_host_and_origin(self):
        self.assertEqual(self.request('GET','/')[0],200)
        for path in ('/../secret.txt','/%2e%2e/secret.txt','/.hidden'):self.assertEqual(self.request('GET',path)[0],404)
        self.assertEqual(self.request('GET','/api/state',headers={'Host':'evil.example'})[0],403)
        self.assertEqual(self.request('POST','/api/action','{}',{'Content-Type':'application/json','Origin':'https://evil.example'})[0],403)
    def test_actions_and_bad_requests(self):
        self.assertEqual(self.request('POST','/api/action','{}')[0],415)
        self.assertEqual(self.request('POST','/api/action','[]',{'Content-Type':'application/json'})[0],400)
        for action in ('simulation','new_scramble','cancel'):
            status,data=self.request('POST','/api/action',json.dumps({'action':action}),{'Content-Type':'application/json'})
            self.assertEqual(status,200,data)
        self.assertEqual(self.app.practice.source,'simulation');self.assertEqual(self.app.book.list(),[])
