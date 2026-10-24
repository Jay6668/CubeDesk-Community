"""Loopback-only HTTP shell extracted in purpose from the full edition's local host."""
import json
import mimetypes
import threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,unquote

class Server(ThreadingHTTPServer):
    daemon_threads=True
    allow_reuse_address=True

def start_server(app,web,port=0):
    web=Path(web).resolve()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def reply(self,status,body,kind='application/json; charset=utf-8'):
            if isinstance(body,(dict,list)):body=json.dumps(body,ensure_ascii=False,allow_nan=False).encode('utf-8')
            elif isinstance(body,str):body=body.encode('utf-8')
            self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body)))
            self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
            self.end_headers();self.wfile.write(body)
        def valid_host(self):
            return self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        def do_GET(self):
            if not self.valid_host():return self.reply(403,{'error':'Unexpected host'})
            path=unquote(urlsplit(self.path).path)
            if path=='/api/state':return self.reply(200,app.snapshot())
            if path=='/api/records':return self.reply(200,{'schema_version':1,'records':app.book.list(10000)})
            if path.startswith('/api/records/'):
                record=app.book.get(path.rsplit('/',1)[-1]);return self.reply(200 if record else 404,record or {'error':'记录不存在'})
            target=(web/('index.html' if path=='/' else path.lstrip('/'))).resolve()
            if not target.is_relative_to(web) or not target.is_file() or any(p.startswith('.') for p in target.relative_to(web).parts):return self.reply(404,{'error':'Not found'})
            kind=mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
            return self.reply(200,target.read_bytes(),kind)
        def do_POST(self):
            origin=self.headers.get('Origin')
            if not self.valid_host() or (origin and origin not in {f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}'}):return self.reply(403,{'error':'Unexpected origin'})
            if self.path!='/api/action':return self.reply(404,{'error':'Not found'})
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.reply(415,{'error':'JSON required'})
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=16384:raise ValueError('请求长度不合法')
                self.connection.settimeout(5);body=json.loads(self.rfile.read(size));self.connection.settimeout(35)
                if not isinstance(body,dict) or not isinstance(body.get('action'),str):raise ValueError('请求格式不合法')
                result=app.action(body['action'],body)
                return self.reply(200,dict(ok=True,**result))
            except (ValueError,TypeError,KeyError) as error:return self.reply(400,{'ok':False,'error':str(error)[:200]})
            except Exception:return self.reply(503,{'ok':False,'error':'蓝牙或本地操作失败，请检查设备、权限和连接状态'})
    server=Server(('127.0.0.1',int(port)),Handler)
    thread=threading.Thread(target=server.serve_forever,name='community-http',daemon=True);thread.start()
    return server
