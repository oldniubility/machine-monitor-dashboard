import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Monitor, PackageOpen, TrendingUp, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import KpiCard from "../components/KpiCard";
import DeviceTable from "../components/DeviceTable";
import StatusBadge from "../components/StatusBadge";
import { useWebSocket } from "../hooks/useWebSocket";
import { fetchOverview, fetchSnapshots } from "../services/api";
import type { DashboardOverview, DeviceSnapshot } from "../types";

export default function Dashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [devices, setDevices] = useState<DeviceSnapshot[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, { online_status: string; run_status: string }>>({});

  const handleStatusUpdate = useCallback((data: Record<string, { online_status: string; run_status: string }>) => {
    setDeviceStatuses(prev => ({ ...prev, ...data }));
  }, []);

  const wsConnected = useWebSocket(handleStatusUpdate);

  const load = useCallback(async () => {
    const [ov, devs] = await Promise.all([fetchOverview(), fetchSnapshots({ status: statusFilter || undefined })]);
    setOverview(ov);
    setDevices(devs);
  }, [statusFilter]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const mergedDevices = devices.map(d => ({
    ...d,
    online_status: deviceStatuses[d.id]?.online_status ?? d.online_status,
    run_status: deviceStatuses[d.id]?.run_status ?? d.run_status,
  }));

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Monitor size={24} className="text-accent" />
            车间总览
          </h1>
          <p className="text-sm text-muted mt-1">实时监控所有机床设备运行状态</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {wsConnected ? (
            <span className="flex items-center gap-1 text-success"><Wifi size={14} /> 实时连接</span>
          ) : (
            <span className="flex items-center gap-1 text-muted"><WifiOff size={14} /> 轮询模式</span>
          )}
          <span className="text-muted">|</span>
          <span className="text-muted">{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="在线机床"
          value={overview ? `${overview.online_count} / ${overview.total_count}` : "—"}
          sub="启用的设备数"
          icon={<Monitor size={24} />}
          accent="default"
        />
        <KpiCard
          title="今日总产量"
          value={overview ? overview.today_output.toLocaleString() : "—"}
          sub="件"
          icon={<PackageOpen size={24} />}
          accent="success"
        />
        <KpiCard
          title="整体稼动率"
          value={overview ? `${overview.overall_availability}%` : "—"}
          sub="今日"
          icon={<TrendingUp size={24} />}
          accent={overview && overview.overall_availability > 80 ? "success" : overview && overview.overall_availability > 50 ? "warning" : "danger"}
        />
        <KpiCard
          title="活跃报警"
          value={overview?.alarm_count ?? "—"}
          sub="条未处理"
          icon={<AlertTriangle size={24} />}
          accent={overview && overview.alarm_count > 0 ? "danger" : "default"}
        />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted">筛选：</span>
        {["", "running", "standby", "fault", "offline"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              statusFilter === s
                ? "bg-accent text-white"
                : "bg-surface-alt border border-border text-muted hover:text-text"
            }`}
          >
            {s === "" ? "全部" : <StatusBadge status={s} />}
          </button>
        ))}
      </div>

      {/* Device Table */}
      <div className="bg-surface-alt border border-border rounded-lg">
        <DeviceTable
          devices={mergedDevices}
          onSelect={(id) => navigate(`/device/${id}`)}
        />
      </div>
    </div>
  );
}
