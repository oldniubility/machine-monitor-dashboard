"""FastAPI application entry point — machine monitoring dashboard."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, async_session
from app.models.device import Device
from app.models.template import ProtocolTemplate, TemplateItem, RegisterType, DataType
from app.services.modbus_simulator import create_default_simulator
from app.services.collector import CollectorService
from app.services.aggregator import AggregatorService
from app.api import devices, dashboard, ws
from app.api.devices import set_collector
from app.api.dashboard import set_aggregator
from app.api.ws import set_collector_ref, broadcast_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------- Global service instances ----------
modbus_sim = create_default_simulator()
collector_svc = CollectorService()
aggregator_svc = AggregatorService()


async def seed_data():
    """Insert demo devices and protocol templates into the database."""
    from sqlalchemy import select
    async with async_session() as session:
        existing = await session.execute(select(Device).limit(1))
        if existing.scalar():
            logger.info("Database already seeded, skipping.")
            return

        # Template A
        tmpl_a = ProtocolTemplate(
            name="品牌A-标准模板", brand="BrandA", model="CNC-A100", version=1,
            description="品牌A标准寄存器映射"
        )
        session.add(tmpl_a)
        await session.flush()
        items_a = [
            TemplateItem(template_id=tmpl_a.id, item_name="已完成工件数", register_type=RegisterType.holding,
                         address=0, data_type=DataType.uint16, scale=1.0, unit="件", is_counter=True, sort_order=1),
            TemplateItem(template_id=tmpl_a.id, item_name="运行状态", register_type=RegisterType.holding,
                         address=1, data_type=DataType.uint16, scale=1.0, unit="", sort_order=2),
            TemplateItem(template_id=tmpl_a.id, item_name="主轴转速", register_type=RegisterType.holding,
                         address=2, data_type=DataType.uint16, scale=1.0, unit="转/分钟", sort_order=3),
            TemplateItem(template_id=tmpl_a.id, item_name="温度", register_type=RegisterType.holding,
                         address=3, data_type=DataType.uint16, scale=0.1, unit="°C", sort_order=4),
            TemplateItem(template_id=tmpl_a.id, item_name="报警代码", register_type=RegisterType.holding,
                         address=4, data_type=DataType.uint16, scale=1.0, unit="", sort_order=5),
        ]
        session.add_all(items_a)

        # Template B
        tmpl_b = ProtocolTemplate(
            name="品牌B-标准模板", brand="BrandB", model="CNC-B200", version=1,
            description="品牌B标准寄存器映射"
        )
        session.add(tmpl_b)
        await session.flush()
        items_b = [
            TemplateItem(template_id=tmpl_b.id, item_name="已完成工件数", register_type=RegisterType.holding,
                         address=10, data_type=DataType.uint16, scale=1.0, unit="件", is_counter=True, sort_order=1),
            TemplateItem(template_id=tmpl_b.id, item_name="运行状态", register_type=RegisterType.holding,
                         address=11, data_type=DataType.uint16, scale=1.0, unit="", sort_order=2),
        ]
        session.add_all(items_b)

        # Template C
        tmpl_c = ProtocolTemplate(
            name="品牌C-标准模板", brand="BrandC", model="CNC-C300", version=1,
            description="品牌C标准寄存器映射（32位计数器）"
        )
        session.add(tmpl_c)
        await session.flush()
        items_c = [
            TemplateItem(template_id=tmpl_c.id, item_name="已完成工件数", register_type=RegisterType.holding,
                         address=20, data_type=DataType.uint32, byte_order="big_endian", scale=1.0,
                         unit="件", is_counter=True, sort_order=1),
            TemplateItem(template_id=tmpl_c.id, item_name="运行状态", register_type=RegisterType.holding,
                         address=22, data_type=DataType.uint16, scale=1.0, unit="", sort_order=2),
        ]
        session.add_all(items_c)

        # Devices linked to simulators
        devs = [
            Device(device_code="D001", name="CNC-品牌A-001", brand="BrandA", model="CNC-A100",
                   workshop="一车间", ip="127.0.0.1", port=5020, slave_id=1,
                   template_id=tmpl_a.id, interval=5, enabled=True),
            Device(device_code="D002", name="CNC-品牌B-002", brand="BrandB", model="CNC-B200",
                   workshop="一车间", ip="127.0.0.1", port=5021, slave_id=1,
                   template_id=tmpl_b.id, interval=5, enabled=True),
            Device(device_code="D003", name="CNC-品牌C-003", brand="BrandC", model="CNC-C300",
                   workshop="二车间", ip="127.0.0.1", port=5022, slave_id=1,
                   template_id=tmpl_c.id, interval=5, enabled=True),
        ]
        session.add_all(devs)
        await session.commit()
        logger.info(f"Seeded 3 templates and 3 devices.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await seed_data()
    set_collector(collector_svc)
    set_aggregator(aggregator_svc)
    set_collector_ref(collector_svc)
    await modbus_sim.start()
    await collector_svc.start()
    await aggregator_svc.start()
    asyncio.create_task(broadcast_loop())
    logger.info(f"{settings.app_name} started.")
    yield
    # Shutdown
    await collector_svc.stop()
    await aggregator_svc.stop()
    await modbus_sim.stop()
    logger.info("Shutdown complete.")


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router)
app.include_router(dashboard.router)
app.include_router(ws.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "ws_connections": ws.broadcast.connection_count}
