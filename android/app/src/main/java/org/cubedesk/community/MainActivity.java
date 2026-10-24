package org.cubedesk.community;
import android.Manifest;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.webkit.*;
import android.widget.*;
import android.view.*;
import androidx.core.view.*;
import com.chaquo.python.*;
import com.chaquo.python.android.AndroidPlatform;
import java.io.*;
import java.util.concurrent.*;

/** Small host adapted from CubeDesk: independent package, data and shared Python core. */
public class MainActivity extends Activity {
 private WebView web;private String origin="";private volatile boolean destroyed=false;
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 @Override public void onCreate(Bundle state){
  super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  TextView loading=new TextView(this);loading.setText("CubeDesk Community\n正在准备…");loading.setGravity(17);setContentView(loading);
  new NativeBle(this);immersive();
  worker.execute(()->{try{
   File webDir=new File(getFilesDir(),"community-web-"+BuildConfig.VERSION_CODE);copyAssets("web",webDir);
   if(!Python.isStarted())Python.start(new AndroidPlatform(this));
   int port=Python.getInstance().getModule("community_android").callAttr("start",new File(getFilesDir(),"community-data").getAbsolutePath(),webDir.getAbsolutePath()).toInt();
   origin="http://127.0.0.1:"+port;runOnUiThread(()->{if(!destroyed)showWeb();});
  }catch(Throwable error){runOnUiThread(()->{if(!destroyed){TextView message=new TextView(this);message.setText("启动未完成。请检查安装包与系统 WebView。\n"+error.getClass().getSimpleName());setContentView(message);}});}});
 }
 private void immersive(){WindowCompat.setDecorFitsSystemWindows(getWindow(),true);new WindowInsetsControllerCompat(getWindow(),getWindow().getDecorView()).hide(WindowInsetsCompat.Type.systemBars());}
 @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();}
 private void showWeb(){
  web=new WebView(this);WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.addJavascriptInterface(new Object(){
   @JavascriptInterface public String bluetoothState(){
    if(android.os.Build.VERSION.SDK_INT>=31){if(checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)return "permission";}
    else if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return "permission";
    try{android.bluetooth.BluetoothAdapter a=getSystemService(android.bluetooth.BluetoothManager.class).getAdapter();return a==null?"unsupported":a.isEnabled()?"on":"off";}catch(SecurityException e){return "permission";}
   }
   @JavascriptInterface public void request(){runOnUiThread(()->requestPermissions(android.os.Build.VERSION.SDK_INT>=31?new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT}:new String[]{Manifest.permission.ACCESS_FINE_LOCATION},10));}
   @JavascriptInterface public void enableBluetooth(){runOnUiThread(()->{try{startActivity(new Intent(android.bluetooth.BluetoothAdapter.ACTION_REQUEST_ENABLE));}catch(RuntimeException e){Toast.makeText(MainActivity.this,"请在系统设置开启蓝牙",Toast.LENGTH_LONG).show();}});}
  },"AndroidPermissions");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest r){return !r.getUrl().toString().startsWith(origin+"/");}
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest r){return r.getUrl().toString().startsWith(origin+"/")?null:new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
  });setContentView(web);web.loadUrl(origin+"/");
 }
 private void copyAssets(String name,File out)throws IOException{String[] children=getAssets().list(name);if(children!=null&&children.length>0){out.mkdirs();for(String child:children)copyAssets(name+"/"+child,new File(out,child));}else{out.getParentFile().mkdirs();try(InputStream in=getAssets().open(name);OutputStream stream=new FileOutputStream(out)){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)stream.write(buffer,0,n);}}}
 @Override protected void onPause(){super.onPause();worker.execute(()->{if(Python.isStarted())Python.getInstance().getModule("community_android").callAttr("suspend");});}
 @Override protected void onDestroy(){destroyed=true;if(web!=null){web.removeJavascriptInterface("AndroidPermissions");web.destroy();}worker.execute(()->{if(Python.isStarted())Python.getInstance().getModule("community_android").callAttr("stop");});worker.shutdown();super.onDestroy();}
}
