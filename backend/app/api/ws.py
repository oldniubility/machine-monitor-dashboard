"""WebSocket endpoint for real-time dashboard updates."""
import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

logger = logging.getLogger(__name__)


class WSBroadcast:
    """Manages connected WebSocket clients and broadcasts device status updates."""

    def __init__(self):
        self._connections: list[WebSocket] = []
        self._new_alarms: list[dict] = []  # pending alarm notifications to push
        self._running = False
        self._task: asyncio.Task | None = None

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, data: dict):
        msg = json.dumps(data, default=str)
        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.remove(ws)

    def push_alarm(self, alarm: dict):
        """Queue a new alarm notification for broadcast."""
        self._new_alarms.append(alarm)

    async def broadcast_new_alarms(self):
        """Send queued alarm notifications to all clients."""
        while self._new_alarms:
            alarm = self._new_alarms.pop(0)
            await self.broadcast({"type": "alarm_new", "alarm": alarm})

    @property
    def connection_count(self) -> int:
        return len(self._connections)


broadcast = WSBroadcast()

# Reference to collector for status polling
_collector = None


def set_collector_ref(c):
    global _collector
    _collector = c


async def broadcast_loop():
    """Continuously broadcast device statuses to all WS clients."""
    while True:
        if _collector:
            statuses = _collector.get_all_statuses()
            if statuses:
                await broadcast.broadcast({"type": "status_update", "devices": statuses})
        await broadcast.broadcast_new_alarms()
        await asyncio.sleep(2)


@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    await broadcast.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Client can send pings; echo back
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        broadcast.disconnect(websocket)
    except Exception:
        broadcast.disconnect(websocket)
