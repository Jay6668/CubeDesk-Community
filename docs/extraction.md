# 结构与提取范围

沿用 Python + WebGL 的原有架构。Windows 使用 pywebview/Bleak；Android 使用 Chaquopy 与原生 GATT。共享状态和计时不另外写一份。

| 原有逻辑位置 | 社区版位置 | 处理 |
|---|---|---|
| `host/simcube.py` | `core/state.py` | 原 cubie 转动数学提取，解耦 BLE 常量，补合法面转校验 |
| `host/scramble.py` | `core/scramble.py` | 只取随机转动序列生成，不带成绩、比赛、场景 |
| `host/solo.py` 基础使用流程 | `timer/practice.py` | 精简状态机，沿用首转开始、首次复原结束、错步逆回思路 |
| `host/cube.py` | `devices/link.py` / `moyu32.py` | 不复制原文件；原文件有闭源程序集参考历史，仅颜色常量直取。公开字段和加密与 MIT 上游核对，重新组织协议与生命周期 |
| `web/cube3d.js` | `web/renderer/cube3d.js` | 保留原 cubie、相机、层动画、基础网格；移除首页电影和高级材质管线 |
| `web/cube-skins.js` | `web/renderer/skins.js` | 只取经典与星钻切面、Shader、缓冲区渲染 |
| Android `NativeBle.java`、Python JNI 桥 | 同名原生文件与 `devices/android_bridge.py` | 独立包名、限长队列、退订 CCCD，原生 AES |
| 本地 HTTP 宿主 | `app/server.py` | 精简为本机接口和静态资源，加入 Host/Origin/路径边界 |

## 运行目录

`src/cubedesk_community/core`：状态、合法性、打乱。

`devices`：无 UI 的适配器和 BLE 生命周期。`timer`：单调时钟状态机。`storage`：独立 SQLite。`analysis`：转动历史扩展入口。`app`：组装及本机 HTTP。

`web`：实际界面、相机与两套模型。`android`：独立宿主和 Gradle。`tools`：只处理本仓库的构建辅助。`tests`：合成数据，不含实机抓包。`docs` 与 `third_party`：文档与许可。

没有高级主题、云岚墨境、额外皮肤、荣誉/庆祝媒体、用户上传素材、规则引擎、档案、长期趋势、题库、桥式实现、开发板/HID/EasyInput、付费/账号/云服务或完整版更新渠道。原正式版及其资源未删除，工作快照和旧 Git 历史只在私有备份中保留。

社区版没有私人资源仓库或原项目路径的运行依赖。新 Git 历史从本目录开始，不继承完整版的任何提交或分支。
