import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, PackageOpen, Monitor, Factory,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import {
  fetchProductionReport, fetchOEEReport, fetchWorkshopSummary,
} from "../services/api";
import type { ProductionRow, OEERow, WorkshopSummary } from "../types";

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);
  const [production, setProduction] = useState<ProductionRow[]>([]);
  const [oee, setOEE] = useState<OEERow[]>([]);
  const [workshop, setWorkshop] = useState<WorkshopSummary[]>([]);

  useEffect(() => {
    fetchProductionReport({ start, end }).then(setProduction);
    fetchOEEReport({ start, end }).then(setOEE);
    fetchWorkshopSummary(today).then(setWorkshop);
  }, [start, end]);

  // Group production by device for chart
  const deviceOutputMap: Record<string, { code: string; data: { date: string; output: number }[] }> = {};
  production.forEach((r) => {
    if (!deviceOutputMap[r.device_code]) {
      deviceOutputMap[r.device_code] = { code: r.device_code, data: [] };
    }
    deviceOutputMap[r.device_code].data.push({ date: r.period_key, output: r.output_count });
  });

  const chartDevices = Object.values(deviceOutputMap);
  // Merge all dates for aligned chart
  const allDates = [...new Set(production.map(r => r.period_key))].sort();
  const mergedChartData = allDates.map(date => {
    const point: Record<string, string | number> = { date };
    chartDevices.forEach(d => {
      const found = d.data.find(p => p.date === date);
      point[d.code] = found?.output ?? 0;
    });
    return point;
  });

  const COLORS = ["#5E6AD2", "#1ABCFE", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"];

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BarChart3 size={24} className="text-accent" />
          统计报表
        </h1>
        <p className="text-sm text-muted mt-1">产量与稼动率数据分析</p>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-xs text-muted">日期范围：</label>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="bg-surface-alt border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent/30"
        />
        <span className="text-muted text-xs">至</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="bg-surface-alt border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent/30"
        />
      </div>

      {/* Workshop Summary Cards */}
      {workshop.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-muted mb-3 flex items-center gap-2">
            <Factory size={14} /> 车间汇总
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {workshop.map((ws) => (
              <div key={ws.workshop} className="bg-surface-alt border border-border rounded-lg p-4">
                <div className="text-sm font-medium mb-2">{ws.workshop}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted">设备</span>
                    <div className="font-mono">{ws.online_count}/{ws.device_count}</div>
                  </div>
                  <div>
                    <span className="text-muted">产量</span>
                    <div className="font-mono">{ws.total_output.toLocaleString()} 件</div>
                  </div>
                  <div>
                    <span className="text-muted">稼动率</span>
                    <div className="font-mono">{ws.avg_availability}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Output Comparison Chart */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-muted mb-3 flex items-center gap-2">
          <TrendingUp size={14} /> 设备产量对比
        </h2>
        {mergedChartData.length > 0 ? (
          <div className="bg-surface-alt border border-border rounded-lg p-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={mergedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} width={50} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {chartDevices.map((d, i) => (
                  <Line key={d.code} type="monotone" dataKey={d.code} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-xs text-muted text-center py-8 bg-surface-alt border border-border rounded-lg">暂无产量数据</div>
        )}
      </section>

      {/* OEE Table */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-3 flex items-center gap-2">
          <Monitor size={14} /> 稼动率统计
        </h2>
        <div className="bg-surface-alt border border-border rounded-lg overflow-hidden">
          {oee.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 px-3 text-left font-medium">设备</th>
                  <th className="py-2 px-3 text-right font-medium">稼动率</th>
                  <th className="py-2 px-3 text-right font-medium">运行(h)</th>
                  <th className="py-2 px-3 text-right font-medium">待机(h)</th>
                  <th className="py-2 px-3 text-right font-medium">故障(h)</th>
                  <th className="py-2 px-3 text-right font-medium">离线(h)</th>
                </tr>
              </thead>
              <tbody>
                {oee.map((r) => (
                  <tr key={r.device_id} className="border-b border-border/50">
                    <td className="py-2 px-3">
                      <span className="font-mono text-[10px] mr-1.5 text-muted">{r.device_code}</span>
                      {r.device_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      <span className={r.availability >= 80 ? "text-success" : r.availability >= 50 ? "text-warning" : "text-danger"}>
                        {r.availability}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-muted">{r.run_hours}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-muted">{r.standby_hours}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-muted">{r.fault_hours}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-muted">{r.offline_hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-muted text-xs">暂无稼动率数据</div>
          )}
        </div>
      </section>
    </div>
  );
}
