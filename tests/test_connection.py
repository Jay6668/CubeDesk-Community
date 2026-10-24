import asyncio
import tempfile
import time
import unittest
from types import SimpleNamespace as NS
from fixtures import *
from cubedesk_community.devices.link import Link
from cubedesk_community.devices.moyu32 import SERVICE,NOTIFY,WRITE,aes_block

class FakeScanner:
    @staticmethod
    async def discover(**kw):
        return {'one':(NS(name='WCU-SYNTHETIC',address=MAC),NS(local_name='WCU-SYNTHETIC',service_uuids=[SERVICE],manufacturer_data={},rssi=-50))}
class FakeClient:
    instances=[];valid=True;state=True
    def __init__(self,address):
        self.is_connected=False;self.callback=None;self.subs=0;self.unsubs=0;self.writes=[]
        self.services=[NS(uuid=SERVICE,characteristics=[NS(uuid=x) for x in ([NOTIFY,WRITE] if self.valid else [WRITE])])]
        self.instances.append(self)
    async def connect(self):self.is_connected=True
    async def start_notify(self,uuid,callback):self.callback=callback;self.subs+=1
    async def stop_notify(self,uuid):self.callback=None;self.unsubs+=1
    async def disconnect(self):self.is_connected=False
    async def write_gatt_char(self,uuid,data,response=False):
        opcode=Cipher(MAC).transform(data)[0];self.writes.append(opcode)
        if opcode==0xA3 and self.callback and self.state:self.callback(None,snapshot())

class ConnectionTests(unittest.TestCase):
    def setUp(self):
        self.events=[];FakeClient.valid=True;FakeClient.state=True;FakeClient.instances=[]
        self.link=Link(self.events.append,lambda:(FakeScanner,FakeClient,aes_block))
    def tearDown(self):self.link.close()
    def test_scan_connect_reconnect_cleanup(self):
        rows=self.link.scan();self.assertNotIn('address',rows[0]);identity=rows[0]['id']
        self.link.connect(identity);a=FakeClient.instances[-1];self.assertEqual(a.subs,1)
        self.link.connect(identity);b=FakeClient.instances[-1];self.assertFalse(a.is_connected);self.assertIsNone(a.callback)
        self.assertEqual(b.subs,1);self.assertEqual(a.unsubs,1)
        self.link.disconnect();self.assertFalse(b.is_connected);self.assertIsNone(b.callback)
    def test_wrong_characteristics_no_commands(self):
        FakeClient.valid=False;identity=self.link.scan()[0]['id']
        with self.assertRaises(ValueError):self.link.connect(identity)
        self.assertEqual(FakeClient.instances[-1].writes,[]);self.assertFalse(self.link.snapshot()['connected'])
    def test_physical_disconnect_invalidates(self):
        self.link.connect(self.link.scan()[0]['id']);FakeClient.instances[-1].is_connected=False
        limit=time.monotonic()+2
        while self.link.snapshot()['connected'] and time.monotonic()<limit:time.sleep(.03)
        self.assertFalse(self.link.snapshot()['connected']);self.assertTrue(any(e['kind']=='disconnect' for e in self.events))
    def test_cancelled_connect_releases_gatt(self):
        FakeClient.state=False;row=dict(address=MAC,name='synthetic')
        async def exercise():
            task=asyncio.create_task(self.link._connect(row,MAC));await asyncio.sleep(.01);task.cancel()
            await asyncio.gather(task,return_exceptions=True)
        asyncio.run(exercise());self.assertFalse(FakeClient.instances[-1].is_connected)
        self.assertIsNone(self.link.client)
