import { useState, useEffect, useCallback } from "react";
import { Bell, AlertTriangle, Check, Wrench, RotateCw } from "lucide-react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  fetchAlarms, acknowledgeAlarm, resolveAlarm, fetchUnresolvedCount, fetchDevices,
} from "../services/api";
import type { Device } from "../types";

interface AlarmRow {
  id: string;
  device_id: string;
  device_code: string;
  device_name: string;
  alarm_type: string;
  alarm_code: string | null;
  message: string;
  acknowledged: boolean;
  ack_by: string | null;
  ack_at: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

interface AlarmList {
  total: number;
  items: AlarmRow[];
}

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState<AlarmList>({ total: 0, items: [] });
  const [devices, setDevices] = useState<Device[]>([]);
  const [ackFilter, setAckFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [badge, setBadge] = useState(0);

  const load = useCallback(async () => {
    const params: Record<string, string | number | boolean> = { page, page_size: 20 };
    if (ackFilter === "unack") params.acknowledged = false;
    else if (ackFilter === "ack") params.acknowledged = true;
    else if (ackFilter === "resolved") params.resolved = true;
    else if (ackFilter === "unresolved") params.resolved = false;
    if (typeFilter) params.alarm_type = typeFilter;
    if (deviceFilter) params.device_id = deviceFilter;
    const data = await fetchAlarms(params as Record<string, never>);
    setAlarms(data);
    const cnt = await fetchUnresolvedCount();
    setBadge(cnt.count);
  }, [ackFilter, typeFilter, deviceFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchDevices().then(setDevices); }, []);

  // WS: refresh on new alarm
  const handleWS = useCallback((data: Record<string, unknown>) => {
    if (data.type === "alarm_new") load();
  }, [load]);
  useWebSocket(undefined, handleWS);

  const handleAck = async (id: string) => {
    await acknowledgeAlarm(id);
    load();
  };

  const handleResolve = async (id: string) => {
    await resolveAlarm(id);
    load();
  };

  const totalPages = Math.max(1, Math.ceil(alarms.total / 20));

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Bell size={24} className="text-accent" />
          报警记录
        </h1>
        {badge > 0 && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-danger/15 text-danger rounded text-[10px] font-medium">
            {badge} 条未处理
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={ackFilter}
          onChange={(e) => { setAckFilter(e.target.value); setPage(1); }}
          className="bg-surface-alt border border-border rounded px-2 py-1 text-xs focus:outline-none"
        >
          <option value="">全部状态</option>
          <option value="unresolved">未解决</option>
          <option value="unack">未确认</option>
          <option value="ack">已确认</option>
          <option value="resolved">已解决</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-surface-alt border border-border rounded px-2 py-1 text-xs focus:outline-none"
        >
          <option value="">全部类型</option>
          <option value="fault">故障</option>
          <option value="offline">离线</option>
          <option value="communication_error">通信异常</option>
        </select>

        <select
          value={deviceFilter}
          onChange={(e) => { setDeviceFilter(e.target.value); setPage(1); }}
          className="bg-surface-alt border border-border rounded px-2 py-1 text-xs focus:outline-none"
        >
          <option value="">全部设备</option>
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.device_code} {d.name}</option>
          ))}
        </select>

        <button
          onClick={load}
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-text transition-colors"
        >
          <RotateCw size={12} /> 刷新
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-alt border border-border rounded-lg overflow-hidden">
        {alarms.items.length > 0 ? (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 px-3 text-left font-medium w-16">类型</th>
                  <th className="py-2 px-3 text-left font-medium">设备</th>
                  <th className="py-2 px-3 text-left font-medium">内容</th>
                  <th className="py-2 px-3 text-left font-medium w-36">时间</th>
                  <th className="py-2 px-3 text-center font-medium w-16">状态</th>
                  <th className="py-2 px-3 text-center font-medium w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {alarms.items.map((a) => {
                  const isResolved = !!a.resolved_at;
                  return (
                    <tr key={a.id} className={`border-b border-border/50 ${isResolved ? "opacity-50" : ""}`}>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                          a.alarm_type === "fault" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"
                        }`}>
                          <AlertTriangle size={10} />
                          {a.alarm_type === "fault" ? "故障" : a.alarm_type === "offline" ? "离线" : a.alarm_type}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-[10px] text-muted mr-1">{a.device_code}</span>
                        {a.device_name}
                      </td>
                      <td className="py-2 px-3 max-w-[300px] truncate">{a.message}</td>
                      <td className="py-2 px-3 text-muted text-[10px]">
                        {a.created_at ? new Date(a.created_at).toLocaleString("zh-CN") : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {isResolved ? (
                          <span className="text-[10px] text-muted">已解决</span>
                        ) : a.acknowledged ? (
                          <span className="text-[10px] text-success">已确认</span>
                        ) : (
                          <span className="text-[10px] text-danger font-medium">未处理</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {!isResolved && !a.acknowledged && (
                            <button
                              onClick={() => handleAck(a.id)}
                              className="p-1 rounded hover:bg-success/10 text-muted hover:text-success transition-colors"
                              title="确认"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          {!isResolved && (
                            <button
                              onClick={() => handleResolve(a.id)}
                              className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent transition-colors"
                              title="解决"
                            >
                              <Wrench size={14} />
                            </button>
                          )}
                          {isResolved && <span className="text-[10px] text-muted">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border">
              <span className="text-[10px] text-muted">共 {alarms.total} 条</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2 py-0.5 text-[10px] rounded border border-border disabled:opacity-30 hover:bg-white/5 transition-colors"
                >
                  上一页
                </button>
                <span className="px-2 py-0.5 text-[10px] text-muted">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  className="px-2 py-0.5 text-[10px] rounded border border-border disabled:opacity-30 hover:bg-white/5 transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Bell className="mx-auto mb-2 opacity-20" size={32} />
            <p className="text-xs text-muted">暂无报警记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
