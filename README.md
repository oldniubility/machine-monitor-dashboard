# 机床数据监控看板

工厂机床实时监控系统 — Modbus TCP 数据采集、聚合计算、可视化看板。

## 架构

```
Modbus 模拟器(5020-5022) → 采集引擎(5s轮询) → SQLite 时序库 → FastAPI → React 看板
```

## 快速启动

### 后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

API: `http://127.0.0.1:8000` | Docs: `http://127.0.0.1:8000/docs`

### 前端

```bash
cd frontend
npm install
npm run dev
```

看板: `http://localhost:5173`

### 模拟设备

启动后端时会自动创建3台模拟机床：

| 设备 | 品牌 | 端口 | 协议模板 |
|------|------|------|----------|
| D001 | BrandA | 5020 | 品牌A标准模板 (5指标) |
| D002 | BrandB | 5021 | 品牌B标准模板 (2指标) |
| D003 | BrandC | 5022 | 品牌C标准模板 (32位计数器) |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| 后端 | Python + FastAPI + SQLAlchemy + APScheduler |
| 采集 | pymodbus (Modbus TCP) |
| 存储 | SQLite (开发) → InfluxDB/TimescaleDB (生产) |
| 实时 | WebSocket |

## 项目结构

```
├── backend/app/
│   ├── api/          # REST + WebSocket 路由
│   ├── core/         # Modbus 客户端
│   ├── models/       # SQLAlchemy 数据模型
│   └── services/     # 采集引擎、聚合服务、模拟器
└── frontend/src/
    ├── components/   # KpiCard, DeviceTable, StatusBadge
    ├── pages/        # Dashboard 页面
    ├── hooks/        # useWebSocket
    ├── services/     # API 客户端
    └── types/        # TypeScript 类型
```

## 开发阶段

- [x] 第一期：项目骨架 + 车间总览看板
- [ ] 第二期：单机详情 + 统计报表
- [ ] 第三期：报警通知 + 权限管理
