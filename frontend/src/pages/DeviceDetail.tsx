import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Monitor, Wrench, TrendingUp, Clock, AlertTriangle,
  Gauge, Thermometer, RotateCw, PackageOpen,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import StatusBadge from "../components/StatusBadge";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  fetchDevice, fetchDeviceMetrics, fetchDeviceTimeseries,
  fetchDeviceAlarms, fetchDeviceAggregation,
} from "../services/api";
import type {
  Device, MetricItem, TimeseriesPoint, AlarmItem, AggregationItem,
} from "../types";

const METRIC_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  "已完成工件数": PackageOpen,
  "运行状态": Monitor,
  "主轴转速": Gauge,
  "温度": Thermometer,
  "报警代码": AlertTriangle,
};

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [aggregation, setAggregation] = useState<AggregationItem[]>([]);
  const [tsData, setTsData] = useState<TimeseriesPoint[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [tsDays, setTsDays] = useState(1);
  const [aggDays, setAggDays] = useState(7);
  const [deviceStatus, setDeviceStatus] = useState({ online_status: "offline", run_status: "offline" });

  const handleStatusUpdate = useCallback((data: Record<string, { online_status: string; run_status: string }>) => {
    if (id && data[id]) setDeviceStatus(data[id]);
  }, [id]);
  useWebSocket(handleStatusUpdate);

  // Load device info
  useEffect(() => {
    if (!id) return;
    fetchDevice(id).then(setDevice);
  }, [id]);

  // Load metrics on interval
  useEffect(() => {
    if (!id) return;
    const load = () => { fetchDeviceMetrics(id).then(setMetrics); };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  // Load alarms
  useEffect(() => {
    if (!id) return;
    fetchDeviceAlarms(id).then(setAlarms);
  }, [id]);

  // Load aggregation
  useEffect(() => {
    if (!id) return;
    fetchDeviceAggregation(id, "day", aggDays).then(setAggregation);
  }, [id, aggDays]);

  // Load timeseries for selected item
  useEffect(() => {
    if (!id || !selectedItem) return;
    fetchDeviceTimeseries(id, selectedItem, tsDays).then(setTsData);
  }, [id, selectedItem, tsDays]);

  if (!device) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted text-sm">
        加载中…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Back + Header */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-xs text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        返回总览
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Wrench size={24} className="text-accent" />
            {device.name}
          </h1>
          <p className="text-sm text-muted mt-1">
            {device.device_code} · {device.brand} {device.model} · {device.workshop}
          </p>
        </div>
        <StatusBadge status={deviceStatus.run_status === "offline" && deviceStatus.online_status === "offline" ? "offline" : deviceStatus.run_status} />
      </div>

      {/* KPI Grid — real-time metrics */}
      <h2 className="text-sm font-medium text-muted mb-3 flex items-center gap-2">
        <RotateCw size={14} /> 实时指标 (5s刷新)
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {metrics.map((m) => {
          const Icon = METRIC_ICONS[m.item_name] || Monitor;
          return (
            <div
              key={m.item_id}
              onClick={() => { setSelectedItem(selectedItem === m.item_id && m.item_name !== "运行状态" ? "" : m.item_id); }}
              className={`bg-surface-alt border rounded-lg p-3 cursor-pointer transition-colors hover:border-accent/30 ${selectedItem === m.item_id ? "border-accent/50 bg-accent/5" : "border-border"}`}
            >
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                <Icon size={14} />
                {m.item_name}
              </div>
              <div className="text-xl font-mono tabular-nums">
                {m.value.toLocaleString()}
                {m.unit && <span className="text-xs text-muted ml-1 font-sans">{m.unit}</span>}
              </div>
              {m.timestamp && (
                <div className="text-[10px] text-muted mt-1">
                  {new Date(m.timestamp).toLocaleTimeString("zh-CN")}
                </div>
              )}
            </div>
          );
        })}
        {metrics.length === 0 && (
          <div className="col-span-full text-center py-6 text-muted text-xs">暂无实时数据</div>
        )}
      </div>

      {/* Timeseries Chart */}
      {selectedItem && tsData.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted flex items-center gap-2">
              <TrendingUp size={14} />
              {metrics.find(m => m.item_id === selectedItem)?.item_name || "时序数据"}
            </h2>
            <div className="flex gap-1">
              {[1, 3, 7].map(d => (
                <button
                  key={d}
                  onClick={() => setTsDays(d)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${tsDays === d ? "bg-accent/20 text-accent" : "text-muted hover:text-text"}`}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
          <div className="bg-surface-alt border border-border rounded-lg p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={tsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickFormatter={(v) => new Date(v).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} width={50} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(v) => new Date(v as string).toLocaleString("zh-CN")}
                />
                <Line type="monotone" dataKey="value" stroke="#5E6AD2" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Aggregation + Alarms side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aggregation chart */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted flex items-center gap-2">
              <PackageOpen size={14} /> 产量趋势
            </h2>
            <select
              value={aggDays}
              onChange={(e) => setAggDays(Number(e.target.value))}
              className="bg-surface-alt border border-border rounded px-2 py-0.5 text-[10px] text-muted focus:outline-none"
            >
              <option value={7}>近7天</option>
              <option value={14}>近14天</option>
              <option value={30}>近30天</option>
            </select>
          </div>
          {aggregation.length > 0 ? (
            <div className="bg-surface-alt border border-border rounded-lg p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={aggregation}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="period_key" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "#888" }} width={50} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="output_count" name="产量" fill="#5E6AD2" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-muted text-center py-8 bg-surface-alt border border-border rounded-lg">暂无聚合数据</div>
          )}

          {/* Availability mini stats */}
          {aggregation.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "稼动率", value: `${aggregation[aggregation.length - 1]?.availability?.toFixed(1) ?? "—"}%` },
                { label: "运行时长", value: `${aggregation[aggregation.length - 1]?.run_duration?.toFixed(1) ?? "—"}h` },
                { label: "故障时长", value: `${aggregation[aggregation.length - 1]?.fault_duration?.toFixed(1) ?? "—"}h` },
              ].map((s) => (
                <div key={s.label} className="bg-surface-alt border border-border rounded p-2 text-center">
                  <div className="text-[10px] text-muted">{s.label}</div>
                  <div className="text-sm font-mono mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Alarm history */}
        <section>
          <h2 className="text-sm font-medium text-muted mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> 报警记录
          </h2>
          <div className="bg-surface-alt border border-border rounded-lg overflow-hidden">
            {alarms.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 px-3 text-left font-medium">类型</th>
                    <th className="py-2 px-3 text-left font-medium">内容</th>
                    <th className="py-2 px-3 text-left font-medium">时间</th>
                    <th className="py-2 px-3 text-center font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {alarms.map((a) => (
                    <tr key={a.id} className="border-b border-border/50">
                      <td className="py-2 px-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${a.alarm_type === "fault" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"}`}>
                          {a.alarm_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-[200px] truncate">{a.message}</td>
                      <td className="py-2 px-3 text-muted text-[10px]">
                        {a.created_at ? new Date(a.created_at).toLocaleString("zh-CN") : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {a.acknowledged ? (
                          <span className="text-[10px] text-success">已确认</span>
                        ) : (
                          <span className="text-[10px] text-danger">未处理</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-muted text-xs">暂无报警记录</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
