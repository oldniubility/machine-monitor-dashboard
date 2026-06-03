import { useState, useEffect } from "react";
import { Settings, Monitor, Users, Plus, Trash2, RotateCw, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { fetchDevices } from "../services/api";
import type { Device } from "../types";

interface TemplateItem {
  id?: string; template_id?: string;
  item_name: string; register_type: string; address: number;
  data_type: string; byte_order: string; scale: number;
  unit: string; read_write: string; is_counter: boolean; sort_order: number;
}

interface Template {
  id: string; name: string; brand: string; model: string;
  version: number; description: string; items: TemplateItem[];
}

const REGISTER_TYPES = ["coil", "discrete", "holding", "input"];
const DATA_TYPES = ["uint16", "int16", "uint32", "int32", "float32"];
const BYTE_ORDERS = ["big_endian", "little_endian", "word_swap"];
const DEFAULT_ITEM = (): TemplateItem => ({
  item_name: "", register_type: "holding", address: 0, data_type: "uint16",
  byte_order: "big_endian", scale: 1, unit: "", read_write: "ro", is_counter: false, sort_order: 0,
});

export default function SettingsPage() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState<"devices" | "users" | "templates">("devices");
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <h1 className="text-2xl font-semibold flex items-center gap-2 mb-6">
        <Settings size={24} className="text-accent" />
        系统配置
      </h1>
      <div className="flex gap-1 mb-6">
        {[
          { id: "devices" as const, icon: Monitor, label: "设备管理" },
          { id: "templates" as const, icon: FileText, label: "协议模板" },
          ...(isAdmin ? [{ id: "users" as const, icon: Users, label: "用户管理" }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              tab === t.id ? "bg-accent/15 text-accent" : "text-muted hover:text-text"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "devices" ? <DeviceTab token={token} />
       : tab === "templates" ? <TemplateTab token={token} />
       : <UserTab token={token} />}
    </div>
  );
}

function DeviceTab({ token }: { token: string | null }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ device_code: "", name: "", brand: "", model: "", workshop: "", ip: "127.0.0.1", port: 502, slave_id: 1, template_id: "", interval: 5, enabled: true });
  const [msg, setMsg] = useState("");
  const load = async () => {
    setDevices(await fetchDevices());
    const r = await fetch("/api/templates", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setTemplates(await r.json());
  };
  useEffect(() => { load(); }, []);
  const resetForm = () => {
    setForm({ device_code: "", name: "", brand: "", model: "", workshop: "", ip: "127.0.0.1", port: 502, slave_id: 1, template_id: "", interval: 5, enabled: true });
    setEditingId(null); setShowForm(false); setMsg("");
  };
  const handleSubmit = async () => {
    const url = editingId ? `/api/devices/${editingId}` : "/api/devices";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    if (res.ok) { setMsg(editingId ? "更新成功" : "创建成功"); resetForm(); load(); }
    else { const err = await res.json(); setMsg(`错误: ${err.detail || "操作失败"}`); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该设备？")) return;
    await fetch(`/api/devices/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-3"><span className="text-xs text-muted">{devices.length} 台设备</span><button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-accent text-white"><Plus size={12} />添加设备</button></div>
      {showForm && (
        <div className="bg-surface-alt border border-border rounded-lg p-4 mb-4"><h3 className="text-sm font-medium mb-3">{editingId ? "编辑" : "添加"}设备</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {["device_code:设备编号:text","name:设备名称:text","brand:品牌:text","model:型号:text","workshop:车间:text","ip:IP:text","port:端口:number","slave_id:从站ID:number","interval:采集间隔(s):number"].map(s => { const [k,label,type]=s.split(":"); return (<div key={k}><label className="block text-[10px] text-muted mb-0.5">{label}</label><input type={type} value={(form as Record<string,unknown>)[k] as string} onChange={e=>setForm(p=>({...p,[k]:type==="number"?Number(e.target.value):e.target.value}))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" /></div>); })}
            <div><label className="block text-[10px] text-muted mb-0.5">协议模板</label><select value={form.template_id} onChange={e=>setForm(p=>({...p,template_id:e.target.value}))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none"><option value="">无</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="block text-[10px] text-muted mb-0.5">启用</label><select value={form.enabled?"1":"0"} onChange={e=>setForm(p=>({...p,enabled:e.target.value==="1"}))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none"><option value="1">是</option><option value="0">否</option></select></div>
          </div>
          {msg && <p className="text-[10px] text-muted mb-2">{msg}</p>}
          <div className="flex gap-2"><button onClick={handleSubmit} className="px-3 py-1 rounded text-xs bg-accent text-white">{editingId?"保存":"创建"}</button><button onClick={resetForm} className="px-3 py-1 rounded text-xs border border-border text-muted">取消</button></div>
        </div>
      )}
      <div className="bg-surface-alt border border-border rounded-lg overflow-hidden"><table className="w-full text-xs"><thead><tr className="border-b border-border text-muted"><th className="py-2 px-2 text-left">编号</th><th className="py-2 px-2 text-left">名称</th><th className="py-2 px-2 text-left">品牌/型号</th><th className="py-2 px-2 text-left">车间</th><th className="py-2 px-2 text-left">IP:端口</th><th className="py-2 px-2 text-center">状态</th><th className="py-2 px-2 text-center w-20">操作</th></tr></thead><tbody>{devices.map(d=>(<tr key={d.id} className="border-b border-border/50"><td className="py-2 px-2 font-mono text-[10px]">{d.device_code}</td><td className="py-2 px-2">{d.name}</td><td className="py-2 px-2 text-muted">{d.brand}/{d.model}</td><td className="py-2 px-2 text-muted">{d.workshop}</td><td className="py-2 px-2 font-mono text-[10px] text-muted">{d.ip}:{d.port}</td><td className="py-2 px-2 text-center"><span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${d.enabled?"bg-success/15 text-success":"bg-muted/15 text-muted"}`}>{d.enabled?"启用":"停用"}</span></td><td className="py-2 px-2"><div className="flex items-center justify-center gap-1"><button onClick={()=>{setForm({device_code:d.device_code,name:d.name,brand:d.brand,model:d.model,workshop:d.workshop,ip:d.ip,port:d.port,slave_id:d.slave_id,template_id:d.template_id||"",interval:d.interval,enabled:d.enabled});setEditingId(d.id);setShowForm(true);}} className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent text-[10px]">编辑</button><button onClick={()=>handleDelete(d.id)} className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger"><Trash2 size={12} /></button></div></td></tr>))}</tbody></table></div>
    </div>
  );
}

function TemplateTab({ token }: { token: string | null }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", brand: "", model: "", version: 1, description: "" });
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [msg, setMsg] = useState("");
  const load = async () => {
    const res = await fetch("/api/templates", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setTemplates(await res.json());
  };
  useEffect(() => { load(); }, []);
  const reset = () => { setForm({ name: "", brand: "", model: "", version: 1, description: "" }); setItems([]); setEditing(null); setMsg(""); };
  const addItem = () => setItems(prev => [...prev, DEFAULT_ITEM()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<TemplateItem>) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const handleSave = async () => {
    const payload = { ...form, items: items.map(({ id, template_id, ...rest }) => rest) };
    const url = editing ? `/api/templates/${editing.id}` : "/api/templates";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) { setMsg(editing ? "保存成功" : "创建成功"); reset(); load(); }
    else { const err = await res.json(); setMsg(`错误: ${err.detail}`); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该模板？关联的设备会失去协议配置。")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };
  const startEdit = (t: Template) => { setEditing(t); setForm({ name: t.name, brand: t.brand, model: t.model, version: t.version, description: t.description }); setItems(t.items.map(i => ({ ...i }))); };
  const toggle = (id: string) => setExpanded(expanded === id ? null : id);
  return (
    <div>
      <div className="flex items-center justify-between mb-3"><span className="text-xs text-muted">{templates.length} 个模板</span><button onClick={() => { reset(); }} className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-accent text-white"><Plus size={12} />新建模板</button></div>
      {(editing !== null || items.length > 0 || form.name) && (
        <div className="bg-surface-alt border border-border rounded-lg p-4 mb-4"><h3 className="text-sm font-medium mb-3">{editing && editing.id ? "编辑模板" : "新建模板"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div><label className="block text-[10px] text-muted mb-0.5">模板名称</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" /></div>
            <div><label className="block text-[10px] text-muted mb-0.5">品牌</label><input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" /></div>
            <div><label className="block text-[10px] text-muted mb-0.5">型号</label><input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" /></div>
            <div><label className="block text-[10px] text-muted mb-0.5">版本</label><input type="number" value={form.version} onChange={e => setForm(p => ({ ...p, version: Number(e.target.value) }))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" /></div>
          </div>
          <div className="mb-3"><label className="block text-[10px] text-muted mb-0.5">描述</label><input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" /></div>
          <div className="mb-3"><div className="flex items-center justify-between mb-1"><span className="text-[10px] text-muted">寄存器项 ({items.length})</span><button onClick={addItem} className="text-[10px] text-accent hover:underline">+ 添加</button></div>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-3 md:grid-cols-6 gap-1.5 mb-1.5 p-2 bg-surface rounded border border-border/50">
                <div><label className="text-[9px] text-muted">名称</label><input value={it.item_name} onChange={e => updateItem(idx, { item_name: e.target.value })} className="w-full bg-surface-alt border border-border rounded px-1.5 py-1 text-[10px] focus:outline-none" /></div>
                <div><label className="text-[9px] text-muted">寄存器</label><select value={it.register_type} onChange={e => updateItem(idx, { register_type: e.target.value })} className="w-full bg-surface-alt border border-border rounded px-1 py-1 text-[10px]">{REGISTER_TYPES.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                <div><label className="text-[9px] text-muted">地址</label><input type="number" value={it.address} onChange={e => updateItem(idx, { address: Number(e.target.value) })} className="w-full bg-surface-alt border border-border rounded px-1.5 py-1 text-[10px] focus:outline-none" /></div>
                <div><label className="text-[9px] text-muted">数据类型</label><select value={it.data_type} onChange={e => updateItem(idx, { data_type: e.target.value })} className="w-full bg-surface-alt border border-border rounded px-1 py-1 text-[10px]">{DATA_TYPES.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="text-[9px] text-muted">系数/单位</label><div className="flex gap-1"><input type="number" step="0.1" value={it.scale} onChange={e => updateItem(idx, { scale: Number(e.target.value) })} className="w-16 bg-surface-alt border border-border rounded px-1.5 py-1 text-[10px] focus:outline-none" /><input value={it.unit} onChange={e => updateItem(idx, { unit: e.target.value })} className="flex-1 bg-surface-alt border border-border rounded px-1.5 py-1 text-[10px] focus:outline-none" placeholder="单位" /></div></div>
                <div className="flex items-end justify-between"><label className="flex items-center gap-1 text-[9px] text-muted"><input type="checkbox" checked={it.is_counter} onChange={e => updateItem(idx, { is_counter: e.target.checked })} /> 计数器</label><button onClick={() => removeItem(idx)} className="p-0.5 rounded hover:bg-danger/10 text-muted hover:text-danger"><Trash2 size={11} /></button></div>
              </div>
            ))}
          </div>
          {msg && <p className="text-[10px] text-muted mb-2">{msg}</p>}
          <div className="flex gap-2"><button onClick={handleSave} className="px-3 py-1 rounded text-xs bg-accent text-white">{editing && editing.id ? "保存" : "创建"}</button><button onClick={reset} className="px-3 py-1 rounded text-xs border border-border text-muted">取消</button></div>
        </div>
      )}
      <div className="space-y-2">{templates.map(t => (
        <div key={t.id} className="bg-surface-alt border border-border rounded-lg overflow-hidden">
          <div className="flex items-center px-4 py-2 cursor-pointer hover:bg-white/[0.02]" onClick={() => toggle(t.id)}>
            {expanded === t.id ? <ChevronDown size={14} className="text-muted mr-2" /> : <ChevronRight size={14} className="text-muted mr-2" />}
            <span className="text-sm font-medium flex-1">{t.name}</span>
            <span className="text-[10px] text-muted mr-3">{t.brand} / {t.model} v{t.version}</span>
            <span className="text-[10px] text-muted mr-3">{t.items.length} 项寄存器</span>
            <button onClick={e => { e.stopPropagation(); startEdit(t); }} className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent text-[10px] mr-1">编辑</button>
            <button onClick={e => { e.stopPropagation(); handleDelete(t.id); }} className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger"><Trash2 size={12} /></button>
          </div>
          {expanded === t.id && (
            <div className="border-t border-border px-4 py-2">
              <p className="text-[10px] text-muted mb-1">{t.description || "无描述"}</p>
              <table className="w-full text-[10px]"><thead><tr className="text-muted"><th className="py-1 text-left">名称</th><th className="py-1 text-left">寄存器</th><th className="py-1 text-left">地址</th><th className="py-1 text-left">类型</th><th className="py-1 text-left">系数</th><th className="py-1 text-left">单位</th><th className="py-1 text-center">计数器</th></tr></thead>
                <tbody>{t.items.map(i => (<tr key={i.id} className="border-t border-border/30"><td className="py-1">{i.item_name}</td><td className="py-1">{i.register_type}</td><td className="py-1 font-mono">{i.address}</td><td className="py-1">{i.data_type}</td><td className="py-1 font-mono">{i.scale}</td><td className="py-1">{i.unit}</td><td className="py-1 text-center">{i.is_counter ? "✓" : ""}</td></tr>))}</tbody></table>
            </div>
          )}
        </div>
      ))}</div>
    </div>
  );
}

interface UserRow { id: string; username: string; role: string; created_at: string | null; }
function UserTab({ token }: { token: string | null }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "viewer" });
  const [msg, setMsg] = useState("");
  const load = async () => { const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setUsers(await res.json()); };
  useEffect(() => { load(); }, []);
  const handleCreate = async () => {
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newUser) });
    if (res.ok) { setMsg("用户创建成功"); setNewUser({ username: "", password: "", role: "viewer" }); setShowForm(false); load(); }
    else { const err = await res.json(); setMsg(`错误: ${err.detail}`); }
  };
  const handleDelete = async (id: string) => { if (!confirm("确定删除该用户？")) return; await fetch(`/api/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); load(); };
  return (
    <div>
      <div className="flex items-center justify-between mb-3"><span className="text-xs text-muted">{users.length} 个用户</span><button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-accent text-white"><Plus size={12} />添加用户</button></div>
      {showForm && (<div className="bg-surface-alt border border-border rounded-lg p-4 mb-4"><h3 className="text-sm font-medium mb-3">添加用户</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><label className="block text-[10px] text-muted mb-0.5">用户名</label><input value={newUser.username} onChange={e=>setNewUser(p=>({...p,username:e.target.value}))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" /></div>
          <div><label className="block text-[10px] text-muted mb-0.5">密码</label><input type="password" value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-accent/30" /></div>
          <div><label className="block text-[10px] text-muted mb-0.5">角色</label><select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs focus:outline-none"><option value="viewer">viewer</option><option value="operator">operator</option><option value="admin">admin</option></select></div>
        </div>
        {msg && <p className="text-[10px] text-muted mb-2">{msg}</p>}
        <div className="flex gap-2"><button onClick={handleCreate} className="px-3 py-1 rounded text-xs bg-accent text-white">创建</button><button onClick={()=>{setShowForm(false);setMsg("");}} className="px-3 py-1 rounded text-xs border border-border text-muted">取消</button></div>
      </div>)}
      <div className="bg-surface-alt border border-border rounded-lg overflow-hidden"><table className="w-full text-xs"><thead><tr className="border-b border-border text-muted"><th className="py-2 px-3 text-left">用户名</th><th className="py-2 px-3 text-left">角色</th><th className="py-2 px-3 text-left">创建时间</th><th className="py-2 px-3 text-center w-16">操作</th></tr></thead><tbody>{users.map(u=>(<tr key={u.id} className="border-b border-border/50"><td className="py-2 px-3">{u.username}</td><td className="py-2 px-3"><span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent">{u.role==="admin"?"管理员":u.role==="operator"?"操作员":"查看者"}</span></td><td className="py-2 px-3 text-muted text-[10px]">{u.created_at?new Date(u.created_at).toLocaleString("zh-CN"):"—"}</td><td className="py-2 px-3 text-center">{u.username!=="admin"&&<button onClick={()=>handleDelete(u.id)} className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger"><Trash2 size={12} /></button>}</td></tr>))}</tbody></table></div>
    </div>
  );
}
