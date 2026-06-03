const BASE = "/api";

export async function fetchOverview() {
  const res = await fetch(`${BASE}/dashboard/overview`);
  return res.json();
}

export async function fetchSnapshots(params?: { status?: string; workshop?: string }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.workshop) qs.set("workshop", params.workshop);
  const res = await fetch(`${BASE}/dashboard/snapshots?${qs}`);
  return res.json();
}

export async function fetchDevices() {
  const res = await fetch(`${BASE}/devices`);
  return res.json();
}

export async function fetchDeviceOutput(deviceId: string, days = 7) {
  const res = await fetch(`${BASE}/dashboard/charts/daily-output?device_id=${deviceId}&days=${days}`);
  return res.json();
}

export async function fetchDevice(deviceId: string) {
  const res = await fetch(`${BASE}/devices/${deviceId}`);
  return res.json();
}

export async function fetchDeviceMetrics(deviceId: string) {
  const res = await fetch(`${BASE}/devices/${deviceId}/metrics`);
  return res.json();
}

export async function fetchDeviceTimeseries(deviceId: string, itemId: string, days = 1, limit = 200) {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const res = await fetch(
    `${BASE}/devices/${deviceId}/timeseries?item_id=${itemId}&start=${start}&end=${end}&limit=${limit}`
  );
  return res.json();
}

export async function fetchDeviceAlarms(deviceId: string, limit = 20) {
  const res = await fetch(`${BASE}/devices/${deviceId}/alarms?limit=${limit}`);
  return res.json();
}

export async function fetchDeviceAggregation(deviceId: string, periodType = "day", days = 7) {
  const res = await fetch(
    `${BASE}/devices/${deviceId}/aggregation?period_type=${periodType}&days=${days}`
  );
  return res.json();
}

export async function fetchProductionReport(params: {
  start?: string;
  end?: string;
  workshop?: string;
  device_id?: string;
  period_type?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.workshop) qs.set("workshop", params.workshop);
  if (params.device_id) qs.set("device_id", params.device_id);
  if (params.period_type) qs.set("period_type", params.period_type);
  const res = await fetch(`${BASE}/reports/production?${qs}`);
  return res.json();
}

export async function fetchOEEReport(params: { start?: string; end?: string; device_id?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.device_id) qs.set("device_id", params.device_id);
  const res = await fetch(`${BASE}/reports/oee?${qs}`);
  return res.json();
}

export async function fetchWorkshopSummary(date?: string) {
  const qs = date ? `?target_date=${date}` : "";
  const res = await fetch(`${BASE}/reports/workshop-summary${qs}`);
  return res.json();
}

// ── Alarms ──

export async function fetchAlarms(params: {
  device_id?: string;
  alarm_type?: string;
  acknowledged?: boolean;
  resolved?: boolean;
  page?: number;
  page_size?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.device_id) qs.set("device_id", params.device_id);
  if (params.alarm_type) qs.set("alarm_type", params.alarm_type);
  if (params.acknowledged !== undefined) qs.set("acknowledged", String(params.acknowledged));
  if (params.resolved !== undefined) qs.set("resolved", String(params.resolved));
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const res = await fetch(`${BASE}/alarms?${qs}`);
  return res.json();
}

export async function acknowledgeAlarm(alarmId: string, ackBy = "operator") {
  const res = await fetch(`${BASE}/alarms/${alarmId}/acknowledge`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ack_by: ackBy }),
  });
  return res.json();
}

export async function resolveAlarm(alarmId: string) {
  const res = await fetch(`${BASE}/alarms/${alarmId}/resolve`, { method: "PUT" });
  return res.json();
}

export async function fetchUnresolvedCount() {
  const res = await fetch(`${BASE}/alarms/unresolved-count`);
  return res.json();
}
