import { useState, useEffect } from "react";
import { Settings, Monitor, Users, Plus, Trash2, RotateCw } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { fetchDevices } from "../services/api";
import type { Device } from "../types";

export default function SettingsPage() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState<"devices" | "users">("devices");
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <h1 className="text-2xl font-semibold flex items-center gap-2 mb-6">
        <Settings size={24} className="text-accent" />
        系统配置
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setTab("devices")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
            tab === "devices" ? "bg-accent/15 text-accent" : "text-muted hover:text-text"
          }`}
        >
          <Monitor size={14} /> 设备管理
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("users")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              tab === "users" ? "bg-accent/15 text-accent" : "text-muted hover:text-text"
            }`}
          >
            <Users size={14} /> 用户管理
          </button>
        )}
      </div>

      {tab === "devices" ? <DeviceTab token={token} /> : isAdmin ? <UserTab token={token} /> : null}
    </div>
  );
}

// ── Device Management Tab ──

function DeviceTab({ token }: { token: string | null }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    device_code: "", name: "", brand: "", model: "", workshop: "",
    ip: "127.0.0.1", port: 502, slave_id: 1, template_id: "", interval: 5, enabled: true,
  });
  const [msg, setMsg] = useState("");

  const load = async () => {
    const data = await fetchDevices();
    setDevices(data);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ device_code: "", name: "", brand: "", model: "", workshop: "", ip: "127.0.0.1", port: 502, slave_id: 1, template_id: "", interval: 5, enabled: true });
    setEditingId(null);
    setShowForm(false);
    setMsg("");
  };

  const handleSubmit = async () => {
    const url = editingId ? `/api/devices/${editingId}` : "/api/devices";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setMsg(editingId ? "更新成功" : "创建成功");
      resetForm();
      load();
    } else {
      const err = await res.json();
      setMsg(`错误: ${err.detail || "操作失败"}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该设备？")) return;
    await fetch(`/api/devices/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  const handleEdit = (d: Device) => {
    setForm({
      device_code: d.device_code, name: d.name, brand: d.brand, model: d.model,
      workshop: d.workshop, ip: d.ip, port: d.port, slave_id: d.slave_id,
      template_id: d.template_id || "", interval: d.interval, enabled: d.enabled,
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted">{devices.length} 台设备</span>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-text transition-colors">
            <RotateCw size={12} /> 刷新
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-accent text-white hover:bg-accent/90 transition-colors">
            <Plus size={12} /> 添加设备
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-surface-alt border border-border rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium mb-3">{editingId ? "编辑设备" : "添加设备"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {[
              { k: "device_code", label: "设备编号", type: "text" },
              { k: "name", label: "设备名称", type: "text" },
              { k: "brand", label: "品牌", type: "text" },
              { k: "model", label: "型号", type: "text" },
              { k: "workshop", label: "车间", type: "text" },
              { k: "ip", label: "IP", type: "text" },
              { k: "port", label: "端口", type: "number" },
              { k: "slave_id", label: "从站ID", type: "number" },
              { k: "interval", label: "采集间隔(s)", type: "number" },
            ].map(({ k, label, type }) => (
              <div key={k}>
                <label className="block text-[10px] text-muted mb-0.5">{label}</label>
                <input
                  type={type}
                  value={(form as Record<string, unknown>)[k] as string}
                  onChange={(e) => setForm(prev => ({ ...prev, [k]: type === "number" ? Number(e.target.value) : e.target.value }))}
                  className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30"
                />
              </div>
            ))}
            <div>
              <label className="block text-[10px] text-muted mb-0.5">启用</label>
              <select
                value={form.enabled ? "1" : "0"}
                onChange={(e) => setForm(prev => ({ ...prev, enabled: e.target.value === "1" }))}
                className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
              >
                <option value="1">是</option>
                <option value="0">否</option>
              </select>
            </div>
          </div>
          {msg && <p className="text-[10px] text-muted mb-2">{msg}</p>}
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="px-3 py-1 rounded text-xs bg-accent text-white hover:bg-accent/90">{editingId ? "保存" : "创建"}</button>
            <button onClick={resetForm} className="px-3 py-1 rounded text-xs border border-border text-muted hover:text-text">取消</button>
          </div>
        </div>
      )}

      <div className="bg-surface-alt border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 px-2 text-left">编号</th>
              <th className="py-2 px-2 text-left">名称</th>
              <th className="py-2 px-2 text-left">品牌/型号</th>
              <th className="py-2 px-2 text-left">车间</th>
              <th className="py-2 px-2 text-left">IP:端口</th>
              <th className="py-2 px-2 text-center">状态</th>
              <th className="py-2 px-2 text-center w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id} className="border-b border-border/50">
                <td className="py-2 px-2 font-mono text-[10px]">{d.device_code}</td>
                <td className="py-2 px-2">{d.name}</td>
                <td className="py-2 px-2 text-muted">{d.brand} / {d.model}</td>
                <td className="py-2 px-2 text-muted">{d.workshop}</td>
                <td className="py-2 px-2 font-mono text-[10px] text-muted">{d.ip}:{d.port}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${d.enabled ? "bg-success/15 text-success" : "bg-muted/15 text-muted"}`}>
                    {d.enabled ? "启用" : "停用"}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleEdit(d)} className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent text-[10px]">编辑</button>
                    <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── User Management Tab ──

interface UserRow { id: string; username: string; role: string; created_at: string | null; }

function UserTab({ token }: { token: string | null }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "viewer" });
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setUsers(await res.json());
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      setMsg("用户创建成功");
      setNewUser({ username: "", password: "", role: "viewer" });
      setShowForm(false);
      load();
    } else {
      const err = await res.json();
      setMsg(`错误: ${err.detail}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该用户？")) return;
    await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted">{users.length} 个用户</span>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-text transition-colors">
            <RotateCw size={12} /> 刷新
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-accent text-white hover:bg-accent/90 transition-colors">
            <Plus size={12} /> 添加用户
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-surface-alt border border-border rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium mb-3">添加用户</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[10px] text-muted mb-0.5">用户名</label>
              <input value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-0.5">密码</label>
              <input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-0.5">角色</label>
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none">
                <option value="viewer">viewer</option>
                <option value="operator">operator</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          {msg && <p className="text-[10px] text-muted mb-2">{msg}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1 rounded text-xs bg-accent text-white hover:bg-accent/90">创建</button>
            <button onClick={() => { setShowForm(false); setMsg(""); }} className="px-3 py-1 rounded text-xs border border-border text-muted hover:text-text">取消</button>
          </div>
        </div>
      )}

      <div className="bg-surface-alt border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 px-3 text-left">用户名</th>
              <th className="py-2 px-3 text-left">角色</th>
              <th className="py-2 px-3 text-left">创建时间</th>
              <th className="py-2 px-3 text-center w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border/50">
                <td className="py-2 px-3">{u.username}</td>
                <td className="py-2 px-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent">
                    {u.role === "admin" ? "管理员" : u.role === "operator" ? "操作员" : "查看者"}
                  </span>
                </td>
                <td className="py-2 px-3 text-muted text-[10px]">
                  {u.created_at ? new Date(u.created_at).toLocaleString("zh-CN") : "—"}
                </td>
                <td className="py-2 px-3 text-center">
                  {u.username !== "admin" && (
                    <button onClick={() => handleDelete(u.id)} className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger">
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
