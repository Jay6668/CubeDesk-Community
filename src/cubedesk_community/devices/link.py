"""BLE lifecycle adapted from CubeDesk CubeLink, restricted to a MoYu32 adapter.

The UI sees opaque scan IDs. Addresses/session keys never enter records or logs.
One asyncio thread owns a connection, notifications and all writes.
"""
import asyncio
import os
import threading
import time
import uuid
from .moyu32 import Decoder, SERVICE, NOTIFY, WRITE, normalize_mac

def provider():
    if os.environ.get('CUBEDESK_PLATFORM') == 'android':
        from .android_bridge import BleakScanner, BleakClient, native_block
        return BleakScanner, BleakClient, native_block
    from bleak import BleakScanner, BleakClient
    from .moyu32 import aes_block
    return BleakScanner, BleakClient, aes_block

def advertisement_mac(address, manufacturer):
    """Keep the measured CubeDesk 9-byte advertisement layout; never guess prefixes."""
    candidates=[]
    for value in manufacturer.values():
        data=bytes(value)
        if len(data)==9 and data[:2]==b'\0\0':candidates.append(data[3:9][::-1])
        elif len(data)==7:candidates.append(data[1:7][::-1])
    try:address=normalize_mac(address)
    except ValueError:address=None
    candidates=[':'.join(f'{n:02X}' for n in data) for data in candidates if data not in (bytes(6),b'\xff'*6)]
    if address in candidates:return address
    if len(set(candidates))==1:return candidates[0]
    return address

class Link:
    def __init__(self,on_event, backend=provider):
        self.on_event=on_event;self.backend=backend;self.loop=None;self.thread=None
        self.client=None;self.decoder=None;self.watch=None;self.epoch=0
        self.cache={};self.guard=threading.RLock();self.operation=False;self.ready=None
        self.status=dict(connected=False,scanning=False,connecting=False,name='',battery=None,error='',protocol='moyu32',epoch=0)
    def _start(self):
        if self.loop:return
        ready=threading.Event()
        def worker():
            loop=asyncio.new_event_loop();asyncio.set_event_loop(loop);self.loop=loop;ready.set();loop.run_forever()
            pending=asyncio.all_tasks(loop)
            for task in pending:task.cancel()
            if pending:loop.run_until_complete(asyncio.gather(*pending,return_exceptions=True))
            loop.close()
        self.thread=threading.Thread(target=worker,name='community-ble',daemon=True);self.thread.start()
        if not ready.wait(3):raise RuntimeError('蓝牙线程启动超时')
    def _request(self, fn, timeout=25):
        with self.guard:
            if self.operation:raise ValueError('蓝牙正在处理上一个操作，请稍候')
            self.operation=True
            self._start()
        task=asyncio.run_coroutine_threadsafe(fn(),self.loop)
        try:return task.result(timeout)
        except TimeoutError:
            task.cancel();self.status['error']='蓝牙操作超时';raise ValueError('蓝牙操作超时，请重新扫描')
        finally:
            with self.guard:self.operation=False
    def scan(self):return self._request(self._scan,15)
    async def _scan(self):
        scanner,_,_=self.backend();self.status.update(scanning=True,error='')
        try:
            rows=await scanner.discover(timeout=6,return_adv=True);cache={};result=[]
            for _,(dev,adv) in rows.items():
                name=(getattr(adv,'local_name',None) or dev.name or '').strip()
                services={str(s).lower() for s in (adv.service_uuids or [])};mfr=adv.manufacturer_data or {}
                if 'my22' in name.lower():continue
                looks_named=any(s in name.lower() for s in ['wcu','moyu','my33'])
                measured=any(len(bytes(p))==9 and bytes(p)[:3]==b'\0\0\x30' for p in mfr.values())
                if not (SERVICE in services or looks_named or measured):continue
                identity=uuid.uuid4().hex
                cache[identity]=dict(address=dev.address,name=name or 'MoYu 设备',mac=advertisement_mac(dev.address,mfr))
                result.append(dict(id=identity,name=name or 'MoYu 设备（名称缺失）',rssi=getattr(adv,'rssi',None)))
            self.cache=cache;return result
        except Exception:
            self.status['error']='无法扫描，请检查蓝牙、附近设备权限以及其他应用是否占用魔方';raise
        finally:self.status['scanning']=False
    def connect(self,identity,mac=''):
        row=self.cache.get(identity)
        if not row:raise ValueError('扫描结果已失效，请重新扫描')
        salt=normalize_mac(mac) if mac else row['mac']
        if not salt:raise ValueError('广播未包含可用 MAC，请在连接窗口输入魔方真实 MAC；此地址不会保存')
        return self._request(lambda:self._connect(row,salt),30)
    async def _connect(self,row,mac):
        await self._drop();_,client_type,block=self.backend();self.epoch+=1;epoch=self.epoch
        self.status.update(connecting=True,error='',epoch=epoch)
        client=client_type(row['address']);self.client=client
        try:
            await asyncio.wait_for(client.connect(),15)
            valid=False
            for service in client.services:
                chars={str(c.uuid).lower() for c in service.characteristics}
                if str(service.uuid).lower()==SERVICE and {NOTIFY,WRITE}<=chars:valid=True
            if not valid:raise ValueError('此设备没有基础版支持的 MoYu32 服务与特征')
            self.decoder=Decoder(mac,block);self.decoder.epoch=epoch;self.ready=asyncio.Event()
            # Preserve the working CubeDesk initialization and request it again after subscription.
            await client.write_gatt_char(WRITE,self.decoder.cipher.command(0xA1),response=False)
            await client.start_notify(NOTIFY,lambda _,data:self._packet(epoch,bytes(data)))
            for code in (0xA1,0xA3,0xA4):await self._send(code)
            await asyncio.wait_for(self.ready.wait(),8)
            self.status.update(connected=True,connecting=False,name=row['name'],error='')
            self.watch=asyncio.create_task(self._watch(epoch));return True
        except BaseException:
            await self._drop();self.status.update(connecting=False,error='连接失败：请检查权限、型号及其他应用占用');raise
    async def _send(self,opcode):
        if self.client and self.decoder:await self.client.write_gatt_char(WRITE,self.decoder.cipher.command(opcode),response=False)
    def _packet(self,epoch,data):
        if epoch!=self.epoch or not self.decoder:return
        for event in self.decoder.feed(data,time.monotonic()):
            event['epoch']=epoch
            if event['kind']=='state' and self.ready:self.ready.set()
            if event['kind']=='battery':self.status['battery']=event['battery']
            try:self.on_event(event)
            except Exception:
                self.status['error']='设备事件处理失败，请断开后重试'
                continue
            if event['kind']=='gap':asyncio.create_task(self._send(0xA3))
    async def _watch(self,epoch):
        while self.client and self.client.is_connected and epoch==self.epoch:await asyncio.sleep(.15)
        if epoch==self.epoch:
            self.on_event(dict(kind='disconnect',reason='魔方连接已断开，请唤醒后重新连接'))
            await self._drop()
    async def _drop(self):
        self.epoch+=1;client,self.client=self.client,None
        watch,self.watch=self.watch,None
        if watch and watch is not asyncio.current_task():watch.cancel();await asyncio.gather(watch,return_exceptions=True)
        if client:
            try:await client.stop_notify(NOTIFY)
            except Exception:pass
            try:await client.disconnect()
            except Exception:pass
        self.decoder=None;self.status.update(connected=False,connecting=False,name='',battery=None,epoch=self.epoch)
    def disconnect(self):
        if self.loop:self._request(self._drop,8)
        self.on_event(dict(kind='disconnect',reason='已断开魔方'))
    def refresh(self):
        async def sync():
            if not self.decoder or not self.client:raise ValueError('请先连接魔方')
            self.decoder.begin_resync();await self._send(0xA3)
        return self._request(sync,8)
    def snapshot(self):
        return dict(self.status,parse_errors=self.decoder.parse_errors if self.decoder else 0)
    def close(self):
        if not self.loop:return
        try:self.disconnect()
        finally:
            self.loop.call_soon_threadsafe(self.loop.stop)
            if self.thread:self.thread.join(4)
            self.loop=None
