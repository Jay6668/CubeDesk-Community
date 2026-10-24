"""Native Android GATT bridge with one receiver and per-characteristic routing."""
import asyncio,json
from types import SimpleNamespace
from java import jclass
Native=jclass('org.cubedesk.community.NativeBle')

class BleakScanner:
 @staticmethod
 async def discover(timeout=8,return_adv=False):
  rows=json.loads(str(await asyncio.to_thread(Native.instance.scan,int(timeout*1000))))
  result={}
  for row in rows:
   dev=SimpleNamespace(name=row['name'],address=row['addr'])
   adv=SimpleNamespace(local_name=row['name'],rssi=row['rssi'],
    manufacturer_data={int(k):bytes.fromhex(v) for k,v in row['mfr'].items()},service_uuids=row['services'])
   result[row['addr']]=(dev,adv)
  return result if return_adv else [d for d,a in result.values()]

class BleakClient:
 def __init__(self,address,**kwargs):
  self.address=address;self.is_connected=False;self.task=None
  self.services=[];self.name='';self.callbacks={}
 async def __aenter__(self):
  await asyncio.to_thread(Native.instance.connect,self.address)
  self.is_connected=True
  self.name=str(Native.instance.deviceName())
  rows=json.loads(str(Native.instance.services()))
  self.services=[SimpleNamespace(uuid=r['uuid'],characteristics=[
   SimpleNamespace(uuid=c['uuid'],properties=c['properties']) for c in r['characteristics']]) for r in rows]
  return self
 async def __aexit__(self,*args):
  self.is_connected=False;self.callbacks.clear()
  if self.task:
   self.task.cancel();await asyncio.gather(self.task,return_exceptions=True);self.task=None
  await asyncio.to_thread(Native.instance.disconnect)
 async def connect(self):return await self.__aenter__()
 async def disconnect(self):return await self.__aexit__()
 async def start_notify(self,uuid,callback):
  uuid=str(uuid).lower();self.callbacks[uuid]=callback
  try:await asyncio.to_thread(Native.instance.subscribe,uuid)
  except Exception:self.callbacks.pop(uuid,None);raise
  if self.task and not self.task.done():return
  async def receive():
   while self.is_connected:
    # Drain an ordered bounded batch so optional IMU traffic cannot build latency.
    for _ in range(32):
     packet=str(Native.instance.poll())
     if packet=='DISCONNECTED':self.is_connected=False;break
     if not packet:break
     if '|' in packet:
      channel,data=packet.split('|',1)
      receiver=self.callbacks.get(channel.lower())
      if receiver:receiver(channel,bytearray.fromhex(data))
    await asyncio.sleep(.005)
  self.task=asyncio.create_task(receive())
 async def stop_notify(self,uuid):
  self.callbacks.pop(str(uuid).lower(),None)
  await asyncio.to_thread(Native.instance.unsubscribe,uuid)
  if not self.callbacks and self.task:
   self.task.cancel();await asyncio.gather(self.task,return_exceptions=True);self.task=None
 async def write_gatt_char(self,uuid,data,response=False):
  await asyncio.to_thread(Native.instance.write,str(uuid),bytes(data).hex(),response)
 async def read_gatt_char(self,uuid):
  return bytearray.fromhex(str(await asyncio.to_thread(Native.instance.read,str(uuid))))


 async def request_mtu(self,mtu):
  await asyncio.to_thread(Native.instance.ensureMtu,int(mtu))


def native_block(block,key,iv,encrypt):
 return bytes.fromhex(str(Native.crypt(block.hex(),key.hex(),iv.hex(),encrypt,True)))
