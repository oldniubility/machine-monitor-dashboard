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
