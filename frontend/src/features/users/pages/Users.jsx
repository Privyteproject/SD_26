import { useState } from "react";
import { Check, Minus, Plus, Trash2, X, Pencil } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES, ROLE_LABELS, STATUS, STATUS_LABELS } from "../../../lib/constants";
import { DEMO_PASSWORD } from "../../../lib/authStore";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { PERM_MODULES, PERM_GRID, ROLE_SHORT } from "../../../mock/mockData";

const ROLE_ORDER = ["COLLABORATEUR", "MANAGER", "RH", "DIRECTION", "ADMIN", "MEDECINE"];
const EMPTY = { name: "", email: "", password: DEMO_PASSWORD, role: ROLES.COLLABORATEUR, status: STATUS.ACTIVE, dept: "" };

function Cell({ v }) {
  if (v === "RW") return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 6, background: "var(--gold)", color: "var(--on-gold)", alignItems: "center", justifyContent: "center" }}><Check size={13} strokeWidth={3} /></span>;
  if (v === "R") return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 6, border: "1px solid var(--gold)", color: "var(--gold-deep)", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>R</span>;
  return <span style={{ color: "var(--muted)" }}><Minus size={14} /></span>;
}
const inputStyle = { height: 42, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%" };

export default function Users() {
  const { t, lang } = useI18n();
  const { users, addUser, deleteUser, updateUser, currentUser } = useSession();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const startCreate = () => { setEditingId(null); setForm(EMPTY); setErr(""); setOpen(true); };
  const startEdit = (u) => { setEditingId(u.id); setForm({ name: u.name, email: u.email, password: "", role: u.role, status: u.status, dept: u.dept || "" }); setErr(""); setOpen(true); };
  const close = () => { setOpen(false); setEditingId(null); setErr(""); };

  const save = () => {
    if (!form.name.trim() || !form.email.trim() || (!editingId && !form.password)) { setErr(t("usr.errRequired")); return; }
    const dup = users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase() && u.id !== editingId);
    if (dup) { setErr(t("usr.errEmail")); return; }
    if (editingId) {
      const patch = { name: form.name, email: form.email, role: form.role, status: form.status, dept: form.dept };
      if (form.password) patch.password = form.password; // mot de passe inchangé si vide
      updateUser(editingId, patch);
    } else {
      addUser(form);
    }
    close();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("usr.title")}</h1>
        <button onClick={open ? close : startCreate} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          {open ? <X size={17} /> : <Plus size={17} />} {open ? t("usr.cancel") : t("usr.new")}
        </button>
      </div>

      {open && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{editingId ? t("usr.edit") : t("usr.create")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("usr.name")}</label><input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Prénom Nom" /></div>
            <div><label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("usr.email")}</label><input style={inputStyle} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="prenom.nom@synapse.io" /></div>
            <div><label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("usr.password")}{editingId ? ` (${t("usr.pwdKeep")})` : ""}</label><input style={inputStyle} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={editingId ? "••••••" : ""} /></div>
            <div><label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("usr.dept")}</label><input style={inputStyle} value={form.dept} onChange={(e) => set("dept", e.target.value)} placeholder="IT, RH, Ventes…" /></div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("emp.role")}</label>
              <select style={inputStyle} value={form.role} onChange={(e) => set("role", e.target.value)}>
                {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r][lang]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("emp.status")}</label>
              <select style={inputStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {Object.values(STATUS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s][lang]}</option>)}
              </select>
            </div>
          </div>
          {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}>{err}</div>}
          <button onClick={save} style={{ marginTop: 16, height: 44, padding: "0 20px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{editingId ? t("usr.save") : t("usr.add")}</button>
        </Card>
      )}

      <Card style={{ marginTop: 18, padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("usr.user")}</span><span>{t("emp.role")}</span><span>{t("emp.status")}</span><span></span>
        </div>
        {users.map((u, i) => {
          const self = currentUser && u.id === currentUser.id;
          return (
            <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{u.name.charAt(0)}</span>
                <span><span style={{ display: "block" }}>{u.name}</span><span style={{ fontSize: 11.5, color: "var(--muted)" }}>{u.email}</span></span>
              </span>
              <span><Badge tone="gold">{ROLE_LABELS[u.role][lang]}</Badge></span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{STATUS_LABELS[u.status][lang]}</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button onClick={() => startEdit(u)} title={t("usr.edit")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil size={15} /></button>
                <button onClick={() => deleteUser(u.id)} disabled={self} title={t("usr.delete")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: self ? "var(--line)" : "var(--danger)", cursor: self ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} /></button>
              </span>
            </div>
          );
        })}
      </Card>

      <div style={{ marginTop: 24, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("usr.matrix")}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 10px" }}>{t("usr.legend")}</div>
      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead><tr>
            <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid var(--line)" }}>{t("usr.module")}</th>
            {ROLE_ORDER.map((r) => <th key={r} style={{ padding: "12px 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600, borderBottom: "1px solid var(--line)" }}>{ROLE_SHORT[r]}</th>)}
          </tr></thead>
          <tbody>
            {PERM_MODULES.map((m, i) => (
              <tr key={m.key}>
                <td style={{ padding: "12px 16px", fontSize: 13.5, color: "var(--ink)", fontWeight: 500, borderTop: i ? "1px solid var(--line)" : "none" }}>{m.label[lang]}</td>
                {ROLE_ORDER.map((r) => <td key={r} style={{ textAlign: "center", padding: "12px 8px", borderTop: i ? "1px solid var(--line)" : "none" }}><Cell v={PERM_GRID[m.key][r]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
