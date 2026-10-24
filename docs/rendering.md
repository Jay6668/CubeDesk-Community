# 经典与星钻

`web/renderer/cube3d.js` 保留原有 WebGL 几何、cubie 状态、层转动画、拖动相机和状态重建。`skins.js` 只留经典六色及星钻。没有引入新渲染引擎，也没有 Three.js、额外 PBR 资源或网络下载。

经典使用原基础六色和圆角贴纸。星钻使用原 `gemFacets` 三圈八边形切面、切面法线、视角相关反射与高光，反光由 Shader 计算，不是贴图截屏。高级材质分支、环境主题和其他皮肤资源移除。

基本 API：`Cube3D.create(canvas)` → `start()`；`turn(move)` 排队动画；`setFromFacelets(faces)` 接受基线；`defaultView()`；`dispose()` 清理。`Cube3D.setPalette('classic'|'diamond')` 切换模型，逻辑状态不变。

后端是权威状态。UI 按 `cube_epoch` 和事件序号接收：基线变化或事件缺失直接重建，普通面转连续动画，避免用屏幕颜色判断是否完成。`debugFacelets()` 用于调试对照，不用来代替后端计时。

WebGL 不可用会影响3D显示；需现代 Edge/WebView2/Android System WebView 与 GPU/WebGL 支持。本轮软件渲染浏览器结果和原生手机性能不能混为一谈。几何/Shader与项目代码一同按MIT授权；不含不可再分发的钻石贴图或模型。
