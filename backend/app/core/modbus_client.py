"""Async Modbus TCP client wrapper."""
import asyncio
import struct
import logging
from pymodbus.client import AsyncModbusTcpClient
from app.models.template import DataType, ByteOrder, TemplateItem

logger = logging.getLogger(__name__)

STATUS_MAP = {0: "offline", 1: "running", 2: "standby", 3: "fault"}


class ModbusReader:
    """Reads holding registers from a Modbus TCP device and converts via template."""

    def __init__(self, host: str, port: int = 502, slave_id: int = 1, timeout: float = 3.0):
        self.host = host
        self.port = port
        self.slave_id = slave_id
        self.timeout = timeout
        self._client: AsyncModbusTcpClient | None = None

    async def connect(self) -> bool:
        try:
            self._client = AsyncModbusTcpClient(self.host, port=self.port, timeout=self.timeout)
            return await self._client.connect()
        except Exception as e:
            logger.warning(f"Modbus connect failed {self.host}:{self.port}: {e}")
            return False

    async def disconnect(self):
        if self._client:
            self._client.close()
            self._client = None

    async def read_holding_registers(self, address: int, count: int = 1) -> list[int] | None:
        if not self._client or not self._client.connected:
            if not await self.connect():
                return None
        try:
            rr = await self._client.read_holding_registers(address, count=count, slave=self.slave_id)
            if rr.isError():
                return None
            return rr.registers
        except Exception as e:
            logger.warning(f"Read error {self.host}:{self.port} addr={address}: {e}")
            return None

    async def read_all_items(self, items: list[TemplateItem]) -> dict[str, dict]:
        """Read all template items for a device, return {item_id: {raw, converted, status}}."""
        results = {}
        if not await self.connect():
            for item in items:
                results[item.id] = {"raw": None, "converted": None, "status": "offline"}
            return results

        for item in items:
            word_count = 2 if item.data_type in (DataType.uint32, DataType.int32, DataType.float32) else 1
            regs = await self.read_holding_registers(item.address, word_count)
            if regs is None:
                results[item.id] = {"raw": None, "converted": None}
                continue
            raw = self._decode_registers(regs, item.data_type, item.byte_order)
            converted = raw * item.scale if raw is not None else None
            results[item.id] = {"raw": raw, "converted": converted}
        return results

    def _decode_registers(self, regs: list[int], data_type: DataType, byte_order: ByteOrder) -> int | float | None:
        if not regs:
            return None
        if data_type == DataType.uint16:
            return regs[0]
        if data_type == DataType.int16:
            val = regs[0]
            return val - 65536 if val > 32767 else val
        if len(regs) < 2:
            return None
        r0, r1 = regs[0], regs[1]
        if byte_order == ByteOrder.word_swap:
            r0, r1 = r1, r0
        if byte_order == ByteOrder.little_endian:
            combined = r0 | (r1 << 16)
        else:
            combined = (r0 << 16) | r1
        if data_type == DataType.uint32:
            return combined
        if data_type == DataType.int32:
            return combined - 4294967296 if combined > 2147483647 else combined
        if data_type == DataType.float32:
            bs = struct.pack(">I" if byte_order != ByteOrder.little_endian else "<I", combined)
            return struct.unpack(">f" if byte_order != ByteOrder.little_endian else "<f", bs)[0]
        return combined
