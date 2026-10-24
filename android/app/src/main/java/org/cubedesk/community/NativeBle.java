package org.cubedesk.community;

import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.Context;
import android.os.ParcelUuid;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;

/** Single smart cube GATT connection; never scans for or controls the keyboard. */
public final class NativeBle {
 public static NativeBle instance;
 private final Context context;
 private final BluetoothAdapter adapter;
 private volatile BluetoothGatt gatt;
 private volatile boolean connected=false;
 private final BlockingQueue<String> events=new LinkedBlockingQueue<>(2048);
 private final BlockingQueue<String> packets=new LinkedBlockingQueue<>(2048);
 private final BlockingQueue<String> reads=new LinkedBlockingQueue<>(2048);
 private final UUID cccd=UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
 public NativeBle(Context context){this.context=context.getApplicationContext();adapter=((BluetoothManager)context.getSystemService(Context.BLUETOOTH_SERVICE)).getAdapter();instance=this;}
 private void check(){if(adapter==null||!adapter.isEnabled())throw new IllegalStateException("请先打开手机蓝牙，并授权附近设备");}
 public String scan(int duration) throws Exception {
  check();BluetoothLeScanner scanner=adapter.getBluetoothLeScanner();if(scanner==null)throw new IllegalStateException("手机蓝牙扫描不可用");
  Map<String,JSONObject> found=new ConcurrentHashMap<>();
  ScanCallback callback=new ScanCallback(){
   @Override public void onScanResult(int type,ScanResult result){
    try{
     ScanRecord record=result.getScanRecord();if(record==null)return;
     JSONObject row=new JSONObject();row.put("addr",result.getDevice().getAddress());
     String name=record.getDeviceName();row.put("name",name==null?"":name);row.put("rssi",result.getRssi());
     JSONObject mfr=new JSONObject();android.util.SparseArray<byte[]> data=record.getManufacturerSpecificData();
     for(int i=0;i<data.size();i++)mfr.put(String.valueOf(data.keyAt(i)),hex(data.valueAt(i)));
     row.put("mfr",mfr);JSONArray services=new JSONArray();if(record.getServiceUuids()!=null)for(ParcelUuid id:record.getServiceUuids())services.put(id.toString());
     // Keep fields from previous advertisement/scan-response fragments.
     String address=result.getDevice().getAddress();JSONObject old=found.get(address);
     if(old!=null){
      if(row.optString("name").isEmpty())row.put("name",old.optString("name"));
      JSONObject previous=old.optJSONObject("mfr");if(previous!=null){Iterator<String> keys=previous.keys();while(keys.hasNext()){String key=keys.next();if(!mfr.has(key))mfr.put(key,previous.get(key));}}
      Set<String> seen=new HashSet<>();for(int i=0;i<services.length();i++)seen.add(services.getString(i));
      JSONArray previousServices=old.optJSONArray("services");if(previousServices!=null)for(int i=0;i<previousServices.length();i++){String id=previousServices.getString(i);if(seen.add(id))services.put(id);}
     }
     row.put("services",services);found.put(address,row);
    }catch(Exception ignored){}
   }
   @Override public void onScanFailed(int code){events.offer("scan-error:"+code);}
  };
  events.clear();scanner.startScan(null,new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),callback);
  try{Thread.sleep(Math.max(1000,Math.min(duration,15000)));}finally{scanner.stopScan(callback);}
  String failure=events.poll();if(failure!=null&&failure.startsWith("scan-error"))throw new IllegalStateException(failure);
  return new JSONArray(found.values()).toString();
 }
 private final BluetoothGattCallback callback=new BluetoothGattCallback(){
  @Override public void onConnectionStateChange(BluetoothGatt link,int status,int state){
   if(link!=gatt)return;
   if(state==BluetoothProfile.STATE_CONNECTED&&status==BluetoothGatt.GATT_SUCCESS){connected=true;if(!link.discoverServices())events.offer("error:服务发现请求失败");}
   else if(state==BluetoothProfile.STATE_DISCONNECTED){connected=false;events.offer("error:连接断开("+status+")");packets.offer("DISCONNECTED");}
  }
  @Override public void onMtuChanged(BluetoothGatt link,int mtu,int status){if(link==gatt)events.offer("mtu");}
  @Override public void onServicesDiscovered(BluetoothGatt link,int status){if(link!=gatt)return;events.offer(status==0?"services":"error:服务发现失败("+status+")");}
  @Override public void onDescriptorWrite(BluetoothGatt link,BluetoothGattDescriptor d,int status){if(link!=gatt)return;events.offer(status==0?"subscribed":"error:通知订阅失败("+status+")");}
  @Override public void onCharacteristicWrite(BluetoothGatt link,BluetoothGattCharacteristic c,int status){if(link!=gatt)return;events.offer(status==0?"written":"error:写入失败("+status+")");}
  @Override public void onCharacteristicRead(BluetoothGatt link,BluetoothGattCharacteristic c,int status){if(link==gatt)reads.offer(status==0?hex(c.getValue()):"ERROR");}
  @Override public void onCharacteristicRead(BluetoothGatt link,BluetoothGattCharacteristic c,byte[] value,int status){if(link==gatt)reads.offer(status==0?hex(value):"ERROR");}
  @Override public void onCharacteristicChanged(BluetoothGatt link,BluetoothGattCharacteristic c){if(link==gatt)enqueuePacket(c.getUuid().toString()+"|"+hex(c.getValue()));}
  @Override public void onCharacteristicChanged(BluetoothGatt link,BluetoothGattCharacteristic c,byte[] value){if(link==gatt)enqueuePacket(c.getUuid().toString()+"|"+hex(value));}
 };
 private void enqueuePacket(String packet){
  if(!packets.offer(packet)){packets.clear();packets.offer("DISCONNECTED");connected=false;}
 }
 private void waitFor(String expected) throws Exception {
  long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(15);
  while(System.nanoTime()<deadline){String event=events.poll(200,TimeUnit.MILLISECONDS);if(event==null)continue;if(event.startsWith("error:"))throw new IllegalStateException(event.substring(6));if(event.equals(expected))return;}
  throw new IllegalStateException("蓝牙操作超时："+expected);
 }
 public synchronized void connect(String address) throws Exception {
  check();disconnect();events.clear();packets.clear();
  gatt=adapter.getRemoteDevice(address).connectGatt(context,false,callback,BluetoothDevice.TRANSPORT_LE);
  try{waitFor("services");}
  catch(Exception e){disconnect();throw e;}
 }
 private BluetoothGattCharacteristic characteristic(String id){
  BluetoothGatt link=gatt;if(link==null||!connected)throw new IllegalStateException("魔方未连接");
  UUID uuid=UUID.fromString(id);
  for(BluetoothGattService svc:link.getServices()){
   BluetoothGattCharacteristic c=svc.getCharacteristic(uuid);if(c!=null)return c;
  }
  throw new IllegalStateException("魔方特征不存在");
 }
 public synchronized void subscribe(String id) throws Exception {
  BluetoothGattCharacteristic c=characteristic(id);BluetoothGattDescriptor descriptor=c.getDescriptor(cccd);
  if(descriptor==null||!gatt.setCharacteristicNotification(c,true))throw new IllegalStateException("魔方通知不可用");
  events.clear();descriptor.setValue((c.getProperties()&BluetoothGattCharacteristic.PROPERTY_NOTIFY)!=0?
   BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE:BluetoothGattDescriptor.ENABLE_INDICATION_VALUE);
  if(!gatt.writeDescriptor(descriptor))throw new IllegalStateException("通知订阅请求失败");waitFor("subscribed");
 }
 public synchronized void write(String id,String value,boolean response) throws Exception {
  BluetoothGattCharacteristic c=characteristic(id);events.clear();response=response||(c.getProperties()&BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)==0;c.setWriteType(response?BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT:BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);c.setValue(unhex(value));
  if(!gatt.writeCharacteristic(c))throw new IllegalStateException("魔方写入请求失败");waitFor("written");
 }
 public synchronized void ensureMtu(int mtu) throws Exception {
  if(gatt==null||!connected)return;
  events.clear();if(gatt.requestMtu(mtu))waitFor("mtu");
 }
 public synchronized String services() throws Exception {
  if(gatt==null||!connected)throw new IllegalStateException("魔方未连接");
  JSONArray out=new JSONArray();
  for(BluetoothGattService svc:gatt.getServices()){
   JSONObject row=new JSONObject();row.put("uuid",svc.getUuid().toString());JSONArray chars=new JSONArray();
   for(BluetoothGattCharacteristic c:svc.getCharacteristics()){
    JSONObject item=new JSONObject();item.put("uuid",c.getUuid().toString());item.put("properties",c.getProperties());chars.put(item);
   }
   row.put("characteristics",chars);out.put(row);
  }
  return out.toString();
 }
 public String deviceName(){String name=gatt==null?null:gatt.getDevice().getName();return name==null?"":name;}
 public synchronized String read(String id) throws Exception {
  reads.clear();if(!gatt.readCharacteristic(characteristic(id)))throw new IllegalStateException("读取特征失败");
  String value=reads.poll(15,TimeUnit.SECONDS);
  if(value==null||value.equals("ERROR"))throw new IllegalStateException("读取特征超时或失败");return value;
 }
 public synchronized void unsubscribe(String id) throws Exception {
  if(gatt==null||!connected)return;
  BluetoothGattCharacteristic c=characteristic(id);BluetoothGattDescriptor descriptor=c.getDescriptor(cccd);
  if(descriptor!=null){events.clear();descriptor.setValue(BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE);if(gatt.writeDescriptor(descriptor))waitFor("subscribed");}
  gatt.setCharacteristicNotification(c,false);
 }
 public String poll(){String value=packets.poll();return value==null?"":value;}
 public synchronized void disconnect(){BluetoothGatt link=gatt;gatt=null;connected=false;if(link!=null){try{link.disconnect();}finally{link.close();}}packets.clear();}
 private static byte[] unhex(String text){byte[] out=new byte[text.length()/2];for(int i=0;i<out.length;i++)out[i]=(byte)Integer.parseInt(text.substring(i*2,i*2+2),16);return out;}
 private static String hex(byte[] data){if(data==null)return "";StringBuilder out=new StringBuilder();for(byte b:data)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();}
 public static String crypt(String data,String key,String iv,boolean encrypt,boolean cbc) throws Exception {
  Cipher c=Cipher.getInstance(cbc?"AES/CBC/NoPadding":"AES/ECB/NoPadding");SecretKeySpec secret=new SecretKeySpec(unhex(key),"AES");
  if(cbc)c.init(encrypt?Cipher.ENCRYPT_MODE:Cipher.DECRYPT_MODE,secret,new IvParameterSpec(unhex(iv)));else c.init(encrypt?Cipher.ENCRYPT_MODE:Cipher.DECRYPT_MODE,secret);
  return hex(c.doFinal(unhex(data)));
 }
}

