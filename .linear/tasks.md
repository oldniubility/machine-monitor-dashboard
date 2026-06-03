# Linear 任务拆分 — 机床数据监控看板

## 第一期：骨架系统 + 车间总览看板 ✅

| 状态 | 任务 | 优先级 | 标签 |
|------|------|--------|------|
| Done | FastAPI 项目骨架 + 配置管理 | High | backend |
| Done | 数据模型设计 (Device/Template/TimeSeries/Aggregated/Alarm) | High | backend, database |
| Done | Modbus TCP 模拟器 (3品牌) | High | backend, simulator |
| Done | 采集引擎 (pymodbus + APScheduler) | High | backend, collector |
| Done | 聚合服务 (日产量计算) | High | backend, aggregator |
| Done | REST API + WebSocket | High | backend, api |
| Done | 前端 Vite + React + TS + Tailwind 脚手架 | High | frontend |
| Done | 车间总览看板 (KPI + 设备列表 + 状态筛选) | High | frontend, dashboard |
| Done | WebSocket 实时状态推送 | High | frontend, realtime |
| Done | CI 配置 + README | Medium | devops |

## 第二期：单机详情 + 统计报表

| 状态 | 任务 | 优先级 | 标签 |
|------|------|--------|------|
| Todo | 单机详情页 — 实时参数面板 (转速/温度/状态) | High | frontend, device-detail |
| Todo | 单机详情页 — 24h 产量趋势曲线 (Recharts) | High | frontend, charts |
| Todo | 单机详情页 — 7天日产量柱状图 | High | frontend, charts |
| Todo | 单机详情页 — 运行时长分布饼图 | Medium | frontend, charts |
| Todo | 单机详情页 — 报警历史列表 | Medium | frontend, alarms |
| Todo | 后端：单机时序数据查询 API | High | backend, api |
| Todo | 后端：报警历史查询 API | Medium | backend, api |
| Todo | 报表看板 — 日/周/月/年产量趋势图 | High | frontend, reports |
| Todo | 报表看板 — 设备产量排行 | Medium | frontend, reports |
| Todo | 报表看板 — 稼动率分析图 | Medium | frontend, reports |
| Todo | 后端：按时间窗口聚合 (周/月/年) | High | backend, aggregator |
| Todo | 后端：班次配置与按班次统计 | Medium | backend, aggregator |
| Todo | 报表导出 API (Excel) | Low | backend, export |

## 第三期：报警通知 + 权限 + 增强

| 状态 | 任务 | 优先级 | 标签 |
|------|------|--------|------|
| Todo | 报警规则引擎 (状态寄存器变化检测) | High | backend, alarms |
| Todo | 看板声光报警 | High | frontend, alarms |
| Todo | 邮件/钉钉/微信通知集成 | Medium | backend, notifications |
| Todo | RBAC 权限 (管理员/主管/维护员) | High | backend, auth |
| Todo | 前端登录 + 角色视图 | High | frontend, auth |
| Todo | 操作日志记录 | Medium | backend, audit |
| Todo | 断线缓存 + 补传机制 | Medium | backend, reliability |
| Todo | 设备批量导入导出 (CSV/Excel) | Low | backend, tools |
| Todo | 协议模板版本管理 | Low | backend, templates |
| Todo | OPC UA / MQTT 插件化扩展接口 | Low | backend, extensibility |
