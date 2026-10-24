# 三个二次开发入口

## 改界面

修改 `web/index.html` 的结构和 `web/style.css` 的变量、网格。`web/app.js` 只操作本机 API；不要把蓝牙和计时重写到按钮事件。保持 `[hidden]`、弹窗滚动和移动横竖布局。用至少桌面1280×800、手机393×873及873×393检查；浏览器模拟通过后仍需真机。

## 改模型参数

在 `web/renderer/skins.js` 的 definitions 中改当前两种模型的配色，在 gemFacets 修改钻面比例。不要把颜色编号和协议颜色常量改成视觉色值；视觉可以变，逻辑 F/B/U/D/L/R 必须稳定。每次对经典、星钻执行同一转动序列并对照后端。

## 加分析或训练

`analysis/extensions.py` 暴露 `state_history(record)` 和 `analyze(record, callable)`：

```python
from cubedesk_community.analysis.extensions import analyze
def my_analysis(record, states):
    return {'accepted_moves': len(record['moves']), 'state_count': len(states)}
result = analyze(record, my_analysis)
```

这是接口演示，不是 CFOP/Roux 阶段解析。要做桥式，先定义左右块、CMLL/LSE等阶段边界及旋转约定，使用每步状态和 elapsed_ms 判定，给真实与合成样本写测试；不能依据总用时比例猜阶段。

新训练页可以使用 core 状态和独立流程，保持模拟/实体数据分开、完成边界冻结及丢包不产出成绩。存储增加字段时更新 schema_version 和兼容读取；避免把完整版数据库当依赖。

新增协议见 bluetooth.md。没有插件市场或动态执行远程代码；直接用普通模块和依赖注入即可。提交前跑全部测试，说明实际测过哪些平台/设备，保留许可和来源。
