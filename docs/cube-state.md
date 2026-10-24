# 状态和单局数据

固定坐标：白 U、黄 D、绿 F、蓝 B、红 R、橙 L。数值 `F=0 B=1 U=2 D=3 L=4 R=5`。facelets 是六个键各九个整型，按从面外看该面的行优先顺序。数学与 JS 渲染保持原 CubeDesk 约定。

`SimCube.solved()` 建立状态，`cube.turn("R")` 返回新状态而不改变旧状态。接受六面、可选 `2` 或 `'`。不含整体转体、宽转和切片转；扩展时不可把这些符号假装成单面事件。

`validate_facelets` 检查格式、中心、颜色数、8角12棱、方向及奇偶性。`from_facelets` 重建，`replay(start,moves)` 返回起点及每步后状态。打乱是普通随机转动序列，**不是 WCA random-state 打乱**。

单局 `schema_version=1`：

| 字段 | 含义 |
|---|---|
| id / created_at | 随机标识、UTC 完成时间；UTC 不参与计时 |
| source | simulation 或 ble_moyu32，严格区分 |
| time_ms | 首次转动至首次复原的单调时钟毫秒 |
| turns_qtm / tps_qtm | 90°计1、180°计2；同口径 TPS 一位小数，0ms 则 null |
| integrity / outcome | complete / completed，丢包取消的局不存为完成 |
| timestamp_source | host_monotonic 或 host_batch |
| scramble | 练习打乱序列 |
| start_facelets / end_facelets | 首转前打乱状态、首次复原状态 |
| moves | sequence、move、elapsed_ms、device_delta_ms、time_source |

第一步的 elapsed_ms 为0。时间来自收到有效事件的 `time.monotonic()`，设备偏移只保留不冒充校准时间。首次复原后同包多余转动仍更新当前模型，但不改变已冻结记录。

`GET /api/records` 返回自己本机全部记录（最多10000）；`GET /api/records/{id}` 返回一个 JSON。无账号、设备 MAC、私人路径、原始抓包或完整正式版数据库。SQLite 在独立目录，每个操作事务后显式关闭连接。
