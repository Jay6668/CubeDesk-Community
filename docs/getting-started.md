# 开始使用

这是独立社区基础版，不是完整版早期源码快照，自有代码按 MIT 授权。

Windows 10/11 x64，Python 3.11+，系统蓝牙和 Edge WebView2 Runtime。Android 构建另需 Python 3.13、JDK 17+、Android SDK 36。工具不随源码提供。

克隆仓库后，在根目录执行：

```powershell
git clone https://github.com/Jay6668/CubeDesk-Community.git
cd CubeDesk-Community
```

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install ".[desktop,test]"
python -m cubedesk_community
```

纯浏览器演示可不安装桌面额外依赖：`python run.py --headless`，打开终端打印的本机 URL。页面不是远程服务，不需要互联网账号。默认数据在 `%LOCALAPPDATA%/CubeDeskCommunity`，与完整版分开；可指定 `--data-dir ./local-data`。

没有魔方时，点连接入口、进入演示模式、生成打乱、演示执行打乱。随后用面转按钮复原；首转开始计时，第一次复原立即停止。可读取 JSON 验证数据，也可逆序执行打乱的逆步。演示成绩始终有标记，不应拿来当真实成绩。

有设备时，先复原实体并按白上、绿前握持，开启蓝牙、关闭其他连接应用，扫描连接。Android 需要附近设备权限，Android 11 及以前需要位置权限及系统定位开关。若广播无法取得会话 MAC，可只在本次连接中输入真实 MAC，不会持久保存。

当前只含 MoYu32 适配；历史有 MoYu 威龙 V10 AI 实测，本次提取尚未进行硬件复验。其他型号没有承诺。连接失败时保留错误提示，检查权限和设备占用；不要反复重置实体魔方固件。

正在打乱、准备或计时时不允许切换设备。丢包、状态不一致或断连会取消本局，不保存看似完成的错误成绩。重新同步后重新打乱。

点“最近练习”的成绩查看完整 JSON；`GET /api/records` 可以读取自己本机的数据。页面刷新会读取正在运行的后端状态；退出整个程序不恢复未完成的一局，已完成记录保留。此版不提供正式版数据库导入。
