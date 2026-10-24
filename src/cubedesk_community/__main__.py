"""Windows/native and headless entry points share the same isolated application."""
import argparse
import os
from pathlib import Path
import sys
import time
from .app.service import App
from .app.server import start_server

def default_home():
    root=Path(os.environ.get('LOCALAPPDATA',Path.home()/'.local/share'))
    return root/'CubeDeskCommunity'

def main():
    parser=argparse.ArgumentParser(description='CubeDesk Community Edition')
    parser.add_argument('--headless',action='store_true',help='Serve the local developer UI without a native window')
    parser.add_argument('--port',type=int,default=0)
    parser.add_argument('--data-dir',type=Path,default=default_home())
    parser.add_argument('--web-dir',type=Path,default=None)
    args=parser.parse_args()
    web=args.web_dir or (Path(sys._MEIPASS)/'web' if hasattr(sys,'_MEIPASS') else Path(__file__).resolve().parents[2]/'web')
    if args.web_dir is None and not (web/'index.html').is_file():web=Path(sys.prefix)/'share/cubedesk-community/web'
    if not (web/'index.html').is_file():parser.error('Missing web assets; run from a complete source checkout or packaged app')
    app=App(args.data_dir);server=start_server(app,web,args.port);url=f'http://127.0.0.1:{server.server_port}'
    if sys.stdout:print(f'CubeDesk Community: {url}',flush=True)
    try:
        if args.headless:
            while True:time.sleep(.2)
        else:
            import webview
            webview.create_window('CubeDesk Community Edition',url,width=1120,height=760,min_size=(360,520))
            webview.start()
    except KeyboardInterrupt:pass
    finally:app.close();server.shutdown();server.server_close()

if __name__=='__main__':main()
