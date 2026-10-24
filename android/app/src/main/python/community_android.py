"""Only the independent Community core is synchronized into this host."""
import os
os.environ['CUBEDESK_PLATFORM']='android'
from cubedesk_community.app.service import App
from cubedesk_community.app.server import start_server
_app=None
_server=None
def start(data,web):
    global _app,_server
    if _server:return _server.server_port
    _app=App(data);_server=start_server(_app,web)
    return _server.server_port
def suspend():
    if _app:_app.suspend()
def stop():
    global _app,_server
    if _server:_server.shutdown();_server.server_close();_server=None
    if _app:_app.close();_app=None
