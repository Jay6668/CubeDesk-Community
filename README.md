# CubeDesk Community Edition

**独立开源基础版 · MIT License · v0.1.0**

仓库：https://github.com/Jay6668/CubeDesk-Community

从 CubeDesk 1.0.3 中提取的独立基础工程。沿用原有 Python 魔方状态、打乱逻辑与 WebGL 渲染，保留 MoYu32 连接、基础练习和本地记录，供学习和二次开发。

它与 CubeDesk 完整正式版独立：包名、数据目录和本地端口均分开，不读取正式版的成绩、私人目录、资源仓库或更新渠道。高级主题、其他皮肤、成就视频、个人档案、长期统计及开发板/HID联动不在本工程中。

## 快速启动

Python 3.11 或以上，Windows 桌面端需要 Windows 10/11 64位及 Edge WebView2 Runtime。

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install ".[desktop,test]"
python -m cubedesk_community
```

只想在浏览器学习流程，不需要蓝牙或桌面窗口：

```powershell
python run.py --headless
```

打开终端输出的 `http://127.0.0.1:端口`。点“连接魔方 → 进入演示模式”；模拟事件与记录始终带演示标记。默认使用独立的 `CubeDeskCommunity` 本机数据目录，也可用 `--data-dir ./local-data` 指定自己的目录。

## 本版包含

- 三阶状态引擎、六面颜色、正逆转、随机转动序列打乱、状态合法性与完成判定。
- MoYu32 扫描、严格 GATT 特征检查、初始化、通知解析、去重、断连清理、手动重连和刷新状态。
- 经典六色、棱光星钻；沿用原有切面、反射、高光 Shader，不使用在线贴图或其他高级材质资源。
- 打乱准备 → 首转计时 → 首次复原停表 → 单次结果 → 本地记录。
- 主机单调时钟，QTM 步数与同口径 TPS；记录保留批量通知、完整性和时间来源。
- 清晰的单局 JSON、起止状态和转动记录；分析扩展接口，不内置桥式解析。

## 智能魔方范围

只包含 MoYu32 三阶适配器。CubeDesk 完整版历史实测设备为 **MoYu 威龙 V10 AI**。本次提取后的实机验收状态见 [测试报告](docs/test-results.md)；单元测试、假 GATT 和演示流程不是硬件验证。

不据同品牌推断全型号兼容，不包含 GAN、奇艺、二阶、计时器或开发板适配。开发者可按 [蓝牙说明](docs/bluetooth.md) 增加自己的适配器。

## 操作顺序

1. 唤醒魔方，关闭官方 App 或其他占用蓝牙连接的应用，开启系统蓝牙并授权。
2. 连接后按白上、绿前握持。先将实体魔方复原，再点“生成打乱”。
3. 跟随序列打乱；拧错会显示完整逆步返回路径。打乱完成后首转开始计时。
4. 第一刻复原即冻结成绩；同一批后续多转不会延后停表。下一局前请把实体恢复为复原状态。
5. 点最近记录可读取单局 JSON。无联网账号、云同步和正式版自动更新。

## 开发与构建

- [环境与启动](docs/getting-started.md)
- [目录与提取范围](docs/extraction.md)
- [蓝牙协议、时间与兼容性](docs/bluetooth.md)
- [魔方状态与数据格式](docs/cube-state.md)
- [经典与星钻渲染](docs/rendering.md)
- [修改 UI、皮肤与增加分析](docs/extending.md)
- [Windows / Android 构建](docs/building.md)
- [实际测试结果](docs/test-results.md)
- [许可说明](docs/license-proposal.md) 与 [第三方声明](THIRD_PARTY_NOTICES.md)

运行自动化测试：

```powershell
python -m pip install ".[test]"
python -m unittest discover -s tests -v
```

## 用 AI 辅助二次开发

可复制给 Codex 或其他编程助手：

> 先阅读 README、docs/extraction.md 和 docs/extending.md，在 CubeDesk Community 独立工程中工作。我要增加【具体功能】。请先检查现有模块接口，复用 core/state、timer/practice 和单局数据格式，保持真实 BLE 与演示数据区分；不引入完整版私人路径、资源和高级模块。先列改动范围，再实现并补测试，说明实际运行结果。未经我批准不要发布或更改许可证。

## 授权与维护

自有代码采用 MIT，允许学习、修改、再分发和商业用途，须保留版权与许可声明。已有第三方 MIT 等许可单独保留，不因本项目的授权状态而被重新授予或取消。

Community 是精简基础版，不承诺与完整版的全部功能同步。CubeDesk 名称用于说明来源，不授予品牌背书、冒充官方或完整正式版的权利。
