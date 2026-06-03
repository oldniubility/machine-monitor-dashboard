"""
Modbus TCP Simulator — simulates multiple brands/models of machine tools.
Runs as a background thread, exposing holding registers that mimic real machine behavior.
"""
import asyncio
import random
import struct
import time
import logging
from dataclasses import dataclass, field
from typing import Callable

from pymodbus.server import StartAsyncTcpServer
from pymodbus.device import ModbusDeviceIdentification
from pymodbus.datastore import ModbusSlaveContext, ModbusServerContext
from pymodbus.datastore.store import ModbusSequentialDataBlock

logger = logging.getLogger(__name__)


@dataclass
class SimulatedRegister:
    """A single register definition for the simulator."""
    address: int
    value: int
    behavior: str = "static"  # static, counter, random_walk, toggle
    counter_max: int = 0
    counter_min: int = 0
    walk_min: int = 0
    walk_max: int = 100
    walk_step: int = 1


@dataclass
class SimulatedDevice:
    """Definition of one simulated machine."""
    name: str
    slave_id: int
    port: int
    registers: list[SimulatedRegister] = field(default_factory=list)

    def holding_register_values(self) -> list[int]:
        max_addr = max(r.address for r in self.registers) if self.registers else 0
        values = [0] * (max_addr + 1)
        for r in self.registers:
            if r.address < len(values):
                values[r.address] = r.value
        return values


# ---------- Pre-defined machine profiles ----------

def brand_a_production_counters() -> list[SimulatedRegister]:
    """Brand A: work counter at addr 0, status at 1, speed at 2, temp at 3."""
    return [
        SimulatedRegister(address=0, value=12050, behavior="counter", counter_max=65535),
        SimulatedRegister(address=1, value=1, behavior="toggle", walk_min=0, walk_max=3),
        SimulatedRegister(address=2, value=1500, behavior="random_walk", walk_min=800, walk_max=3000, walk_step=50),
        SimulatedRegister(address=3, value=420, behavior="random_walk", walk_min=350, walk_max=480, walk_step=5),
        SimulatedRegister(address=4, value=0, behavior="static"),  # alarm code
    ]


def brand_b_counters() -> list[SimulatedRegister]:
    """Brand B: different address layout — counter at 10, status at 11."""
    regs = [SimulatedRegister(address=i, value=0, behavior="static") for i in range(16)]
    regs[10] = SimulatedRegister(address=10, value=34500, behavior="counter", counter_max=65535)
    regs[11] = SimulatedRegister(address=11, value=0, behavior="toggle", walk_min=0, walk_max=3)
    return regs


def brand_c_counters() -> list[SimulatedRegister]:
    """Brand C: 32-bit counter across two registers (20-21)."""
    regs = [SimulatedRegister(address=i, value=0, behavior="static") for i in range(32)]
    regs[20] = SimulatedRegister(address=20, value=82000, behavior="counter", counter_max=9999999)
    regs[21] = SimulatedRegister(address=21, value=0, behavior="static")  # high word
    regs[22] = SimulatedRegister(address=22, value=1, behavior="toggle", walk_min=0, walk_max=3)
    return regs


# ---------- Simulator runner ----------

class ModbusSimulator:
    """Manages multiple simulated Modbus TCP devices."""

    def __init__(self):
        self.devices: list[SimulatedDevice] = []
        self._context: ModbusServerContext | None = None
        self._tasks: list[asyncio.Task] = []
        self._running = False

    def add_device(self, dev: SimulatedDevice):
        self.devices.append(dev)

    def _build_context(self) -> ModbusServerContext:
        slaves = {}
        for dev in self.devices:
            values = dev.holding_register_values()
            block = ModbusSequentialDataBlock(0, values)
            store = ModbusSlaveContext(hr=block, ir=block, co=block, di=block)
            slaves[dev.slave_id] = store
        # Default slave 0
        if 0 not in slaves:
            slaves[0] = ModbusSlaveContext(
                hr=ModbusSequentialDataBlock(0, [0] * 100),
                ir=ModbusSequentialDataBlock(0, [0] * 100),
            )
        return ModbusServerContext(slaves=slaves, single=False)

    async def _update_registers(self):
        """Periodically mutate register values to simulate real machine behavior."""
        while self._running:
            for dev in self.devices:
                store = self._context[dev.slave_id]
                for reg in dev.registers:
                    if reg.behavior == "counter":
                        new_val = reg.value + random.randint(0, 3)
                        if reg.counter_max > 0 and new_val > reg.counter_max:
                            new_val = reg.counter_min
                        reg.value = new_val
                        store.setValues(3, reg.address, [new_val])
                    elif reg.behavior == "random_walk":
                        delta = random.randint(-reg.walk_step, reg.walk_step)
                        reg.value = max(reg.walk_min, min(reg.walk_max, reg.value + delta))
                        store.setValues(3, reg.address, [reg.value])
                    elif reg.behavior == "toggle":
                        if random.random() < 0.05:
                            reg.value = random.randint(reg.walk_min, reg.walk_max)
                            store.setValues(3, reg.address, [reg.value])
            await asyncio.sleep(2)

    async def start(self):
        self._running = True
        self._context = self._build_context()
        # Start one server per device port (or shared if same port)
        identity = ModbusDeviceIdentification()
        identity.VendorName = "Simulated Machine"
        identity.ProductCode = "SIM"
        identity.MajorMinorRevision = "1.0"

        ports = set(d.port for d in self.devices)
        for port in ports:
            task = asyncio.create_task(
                StartAsyncTcpServer(
                    context=self._context,
                    identity=identity,
                    address=("127.0.0.1", port),
                )
            )
            self._tasks.append(task)
        self._tasks.append(asyncio.create_task(self._update_registers()))
        logger.info(f"Modbus simulator started on ports {ports} with {len(self.devices)} devices")

    async def stop(self):
        self._running = False
        for t in self._tasks:
            t.cancel()
        self._tasks.clear()


def create_default_simulator() -> ModbusSimulator:
    """Create simulator with 3 demo devices (Brand A, B, C)."""
    sim = ModbusSimulator()
    base_port = 5020
    sim.add_device(SimulatedDevice(
        name="CNC-品牌A-001", slave_id=1, port=base_port,
        registers=brand_a_production_counters(),
    ))
    sim.add_device(SimulatedDevice(
        name="CNC-品牌B-002", slave_id=1, port=base_port + 1,
        registers=brand_b_counters(),
    ))
    sim.add_device(SimulatedDevice(
        name="CNC-品牌C-003", slave_id=1, port=base_port + 2,
        registers=brand_c_counters(),
    ))
    return sim
