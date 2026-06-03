# 机床数据监控看板

工厂机床实时监控系统 — Modbus TCP 数据采集、聚合计算、可视化看板、报警管理。

## 架构

```
Modbus 模拟器(5020-5022) → 采集引擎(5s轮询) → SQLite 时序库 → FastAPI → React 看板
```

## 快速启动

### Docker（推荐）

```bash
docker compose up --build
```

访问 `http://localhost`，管理员 `admin` / `admin123`

### 手动启动

```bash
# 后端
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 前端
cd frontend && npm install && npm run dev
```

看板 `http://localhost:5173` | API 文档 `http://127.0.0.1:8000/docs`

## 模拟设备

启动时自动创建 3 台机床：

| 设备 | 品牌 | 端口 | 协议模板 |
|------|------|------|----------|
| D001 | BrandA | 5020 | 品牌A标准模板 (5指标) |
| D002 | BrandB | 5021 | 品牌B标准模板 (2指标) |
| D003 | BrandC | 5022 | 品牌C标准模板 (32位计数器) |

## 功能

| 页面 | 功能 |
|------|------|
| 车间总览 | KPI 卡片、设备状态表、WebSocket 实时更新 |
| 单机详情 | 实时寄存器指标、时序趋势图、产量柱状图、报警历史 |
| 统计报表 | 多设备产量对比、稼动率统计、车间汇总、CSV 导出 |
| 报警记录 | 筛选/确认/解决、WS 实时推送、红色角标 |
| 系统配置 | 设备 CRUD、协议模板管理、用户管理（admin 专属） |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| 后端 | Python 3.11 + FastAPI + SQLAlchemy + APScheduler |
| 采集 | pymodbus (Modbus TCP) |
| 存储 | SQLite (开发) → InfluxDB/TimescaleDB (生产) |
| 实时 | WebSocket（状态推送 + 报警推送） |
| 认证 | SHA256 + 内存 Token（24h 有效期） |
| 部署 | Docker + nginx (SPA 代理) + docker-compose |

## 项目结构

```
├── backend/app/
│   ├── api/          # REST (devices/dashboard/reports/alarms/auth/users/templates) + WS
│   ├── core/         # Modbus 客户端
│   ├── models/       # Device, TimeSeriesData, AggregatedMetric, AlarmLog, ProtocolTemplate, User
│   └── services/     # 采集引擎、聚合服务、Modbus 模拟器
├── frontend/src/
│   ├── components/   # KpiCard, DeviceTable, StatusBadge
│   ├── pages/        # Dashboard, DeviceDetail, Reports, AlarmsPage, SettingsPage, LoginPage
│   ├── hooks/        # useWebSocket, useAuth
│   ├── services/     # API 客户端
│   └── types/        # TypeScript 类型
├── docker-compose.yml
├── DEPLOY.md         # 部署说明
└── USER_GUIDE.md     # 使用手册
```

## 文档

- [部署说明](DEPLOY.md) — Docker / 手动部署 / 环境变量 / 接入真实设备
- [使用手册](USER_GUIDE.md) — 功能导航 / 操作流程 / 常见问题
