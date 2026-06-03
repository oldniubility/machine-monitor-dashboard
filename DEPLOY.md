# 部署说明

## 方式一：Docker Compose（推荐）

一键启动前后端，无需安装 Python/Node 环境。

```bash
# 1. 安装 Docker Desktop (https://www.docker.com)
# 2. 在项目根目录执行
docker compose up --build
```

启动后：
- 看板地址：`http://localhost`（端口 80）
- API 文档：`http://localhost:8000/docs`

首次启动自动创建 demo 数据：
- 管理员账号：`admin` / `admin123`
- 3 台模拟机床（BrandA / BrandB / BrandC）

### 停止与重启

```bash
docker compose down          # 停止并保留数据库
docker compose down -v        # 停止并删除数据库（重新初始化）
docker compose up -d --build  # 后台运行
```

---

## 方式二：手动部署

### 环境要求

| 组件 | 版本 |
|------|------|
| Python | ≥ 3.11 |
| Node.js | ≥ 18 |
| npm | ≥ 9 |

### 后端

```bash
cd backend
pip install -r requirements.txt

# 启动（首次运行自动建库 + 种子数据）
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器默认运行在 `http://localhost:5173`。

### 生产构建

```bash
cd frontend
npm run build

# 产物在 frontend/dist，可用 nginx 托管
# nginx 配置参考 frontend/nginx.conf
```

---

## 环境变量

后端通过 `MMD_` 前缀的环境变量配置（或 `.env` 文件）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MMD_DATABASE_URL` | `sqlite+aiosqlite:///./machine_monitor.db` | 数据库连接 |
| `MMD_COLLECTOR_INTERVAL_DEFAULT` | `5` | 默认采集间隔（秒） |
| `MMD_OFFLINE_THRESHOLD` | `3` | 离线判定阈值（连续失败次数） |
| `MMD_SIMULATOR_BASE_PORT` | `5020` | 模拟器起始端口 |

---

## 数据持久化

Docker 部署使用命名卷 `data` 持久化 SQLite 数据库：

```bash
docker volume ls | grep mmd
```

手动部署时数据库文件位于 `backend/machine_monitor.db`，备份该文件即可迁移数据。

---

## 网络架构

```
浏览器 → nginx(:80) → 静态文件 (frontend/dist)
                     → /api/*  → uvicorn(:8000)
                     → /ws/*   → uvicorn(:8000) WebSocket
```

Docker 中 nginx 和 uvicorn 通过内部网络通信，宿主机只暴露 80 端口。

---

## 接入真实 Modbus 设备

1. 打开看板 → 系统配置 → 协议模板
2. 根据设备文档新建模板，配置寄存器地址/数据类型/系数
3. 系统配置 → 设备管理 → 添加设备，填写真实 IP 和端口
4. 选择刚创建的协议模板，保存

后台采集引擎会自动对启用设备发起 5 秒轮询。
