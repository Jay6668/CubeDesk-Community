# 第三方代码和构建运行时

本项目自有代码使用 MIT；所有者于 2026-10-24 授权公开独立社区版。第三方条款不受该审批影响。

## 随源码提取的部分

- **smartcube-web-bluetooth**：Pau Oliva、Andy Fedotov，MIT。MoYu32 的公开参数、字段、AES 会话推导和 cubie 面索引约定经过该源码核对。固定参考版本 `2077416d6c828ec926dee424cf1bbfe4c0f25a47`。保留全文：`third_party/smartcube-web-bluetooth-MIT.txt`。来源：https://github.com/poliva/smartcube-web-bluetooth/tree/2077416d6c828ec926dee424cf1bbfe4c0f25a47 。Python 实现与连接生命周期来自本项目提取和重写，不将其描述为官方规格。
- **Gradle Wrapper 8.11.1**：Apache-2.0，原脚本版权头保留。来源：https://github.com/gradle/gradle/tree/v8.11.1 。许可全文见 `third_party/Apache-2.0.txt`。

## 安装或打包时的依赖

| 依赖 | 本次固定版本 | 上游许可 |
|---|---|---|
| Python | 3.13 构建运行时 | PSF，另含其自身第三方许可 |
| Bleak | 3.0.2 | MIT |
| PyCryptodome | 3.23.0 | BSD-2-Clause / public domain，保留发行版完整声明 |
| pywebview | 6.2.1 | BSD-3-Clause |
| PyInstaller | 6.22.3 | GPL-2.0-or-later，带发布生成程序的 bootloader exception；不将其源码重新标为 MIT |
| Chaquopy | 17.0.0 | MIT，另附 Python 与运行时依赖条款 |
| AndroidX Core | 1.15.0 | Apache-2.0 |
| Android Gradle Plugin | 8.7.2 | Apache-2.0 |

这些依赖不作为本项目自有代码。Windows 包包含其使用到的运行时许可；Android 包和构建还须保留 Chaquopy/AndroidX 各自发行物声明。源码不包含 SDK、JDK、Windows WebView2 安装程序、签名私钥或其他工具的安装包。

## 资源与排除范围

经典模型、星钻切面、反光 Shader 均提取自 CubeDesk 自有程序式几何，没有外部纹理、字体、HDR 环境图或付费模型。品牌只用文字与基础立方体线框，不迁入完整版专属 Fold 图标。星钻核心效果保留。

未复制 DCTimer-BLE/csTimer 的 GPL 源码；没有将 GPL 文件改许可证。原完整版 BLE 文件包含参考官方闭源程序集的历史说明，整个文件未进入本项目；本项目只提取颜色常量，并将可公开的协议子集与上述 MIT 来源交叉核对。无许可证的逆向资料、真实设备抓包、官方固件、SDK、官方 App 代码均未迁入。

这是来源审查记录，不是专利、商标或所有地区法律意见。公开前需由所有者确认自有代码和资产权属，以及 MIT 许可方案。
