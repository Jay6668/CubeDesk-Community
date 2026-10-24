# 可复现构建

项目不包含私人 SDK 路径、签名证书和完整版构建输出。以下命令在仓库根执行；按自己电脑安装位置设置环境变量。

## Windows

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install ".[desktop,test,build]"
python -m unittest discover -s tests -v
python tools/build_windows.py --output ./artifacts/windows
```

运行 `artifacts/windows/CubeDeskCommunity/CubeDeskCommunity.exe`。整个文件夹必须一起保留，不能只复制 EXE。需要系统 WebView2。默认独立用户数据；测试时可传 `--data-dir ./local-data`。构建脚本不安装、不升级完整版。

## Android

JDK17+（本次21）、Android SDK含platform36与构建工具、Python3.13、Gradle Wrapper8.11.1。不需NDK自行编译模块。依赖首次构建需联网，Android SDK 条款由使用者接受。

```powershell
$env:JAVA_HOME='你的JDK目录'
$env:ANDROID_HOME='你的Android SDK目录'
$env:CUBEDESK_BUILD_PYTHON=(Get-Command python).Source
python tools/sync_android.py
.\android\gradlew.bat -p android assembleDebug --console=plain
```

默认 APK 在 `android/app/build/outputs/apk/debug/app-debug.apk`。可用 `CUBEDESK_ANDROID_BUILD_DIR` 指向自己的大容量构建目录；`GRADLE_USER_HOME` 指向自己的缓存目录。没有本地SDK路径写入 Git。

`sync_android.py` 仅同步本仓库共享源码/网页到忽略的生成目录，每次改动后、构建前执行。包名 `org.cubedesk.community`，版本0.1.0/code1，独立于正式版。方向 `fullUser` 尊重系统旋转锁定。

当前 APK 是供开发者试用的调试签名预览包，尚未完成本轮实机验收；不是正式版替代品。未来稳定发布应由维护者建立独立的 Community 签名策略，不能使用或公开完整版私钥。`assembleRelease` 默认不自动代签。调试签名私钥同样不进源码。

Android WebView只允许自身本机源，INTERNET权限用于本地HTTP，不代表云功能。进入后台会取消本局；记录在本包私有目录中保存。本轮实机状态见 test-results.md。
