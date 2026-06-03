import { useEffect, useRef, useCallback, useState } from "react";

const WS_URL = `ws://${window.location.hostname}:${window.location.port}/ws/dashboard`;

export function useWebSocket(
  onStatusUpdate?: (data: Record<string, { online_status: string; run_status: string }>) => void,
  onAnyMessage?: (data: Record<string, unknown>) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status_update" && onStatusUpdate) {
          onStatusUpdate(data.devices);
        }
        if (onAnyMessage) onAnyMessage(data);
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [onStatusUpdate, onAnyMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current != null) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return connected;
}
