import { useState } from "react";
import { Check, Minus, Plus, Trash2, X, Pencil, Upload } from "lucide-react";
import ImportModal from "./ImportModal";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES, ROLE_LABELS, STATUS, STATUS_LABELS } from "../../../lib/constants";
import { DEMO_PASSWORD } from "../../../lib/authStore";
import { useAsync } from "../../../lib/useAsync";
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from "../../../lib/api";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { PERM_MODULES, PERM_GRID, ROLE_SHORT } from "../../../mock/mockData";

const ROLE_ORDER = ["COLLABORATEUR", "MANAGER", "RH", "DIRECTION", "ADMIN", "MEDECINE"];
const EMPTY = { name: "", email: "", password: DEMO_PASSWORD, role: ROLES.COLLABORATEUR, status: STATUS.ACTIVE, dept: "" };

function Cell({ v }) {
  if (v === "RW") return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 6, background: "var(--gold)", color: "var(--on-gold)", alignItems: "center", justifyContent: "center" }}><Check size={13} strokeWidth={3} /></span>;
  if (v === "R") return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 6, border: "1px solid var(--gold)", color: "var(--gold-deep)", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>R</span>;
  return <span style={{ color: "var(--muted)" }}><Minus size={14} /></span>;
}

// Mappe un employé de l'API ({prenom, nom, ...}) vers la ligne plate affichée ici.
function toRow(e) {
  return {
    id: e.id,
    name: `${e.prenom || ""} ${e.nom || ""}`.trim() || e.email || "—",
    email: e.email || "",
    role: e.role || ROLES.COLLABORATEUR,
    status: e.status || STATUS.ACTIVE,
    dept: e.department || (e.department_id != null ? String(e.department_id) : ""),
  };
}

export default function Users() {
  const { t, lang } = useI18n();
  const { currentUser } = useSession();

  // GET /api/v1/employees (source unique de vérité : UTILISATEUR + EMPLOYE agrégés côté back)
  const { data, loading, error, reload } = useAsync(() => getEmployees());
  const users = ((data && data.data) || []).map(toRow);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const startCreate = () => { setEditingId(null); setForm(EMPTY); setErr(""); setOpen(true); };
  const startEdit = (u) => { setEditingId(u.id); setForm({ name: u.name, email: u.email, password: "", role: u.role, status: u.status, dept: u.dept || "" }); setErr(""); setOpen(true); };
  const close = () => { setOpen(false); setEditingId(null); setErr(""); };

  // Découpe "Prénom Nom" en (prenom, nom) — le backend exige les deux (min_length 1).
  const splitName = (full) => {
    const parts = full.trim().split(/\s+/);
    const prenom = parts[0] || "";
    const nom = parts.slice(1).join(" ") || prenom;
    return { prenom, nom };
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editingId && !form.password)) { setErr(t("usr.errRequired")); return; }
    const dup = users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase() && u.id !== editingId);
    if (dup) { setErr(t("usr.errEmail")); return; }

    const { prenom, nom } = splitName(form.name);
    setSaving(true); setErr("");
    try {
      if (editingId) {
        // PUT /api/v1/employees/{id}
        const patch = { prenom, nom, email: form.email.trim(), role: form.role, status: form.status };
        if (form.dept.trim()) patch.department_id = form.dept.trim();
        await updateEmployee(editingId, patch);
      } else {
        // POST /api/v1/employees (crée le couple utilisateur + employé, + sync Keycloak côté back)
        await createEmployee({
          prenom, nom, email: form.email.trim(), password: form.password,
          role: form.role, status: form.status,
          department_id: form.dept.trim() || undefined,
        });
      }
      close();
      reload();
    } catch (e) {
      setErr((e && (e.payload?.detail || e.message)) || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (u) => {
    if (!window.confirm(t("usr.confirmDelete"))) return;
    setBusyId(u.id);
    try {
      await deleteEmployee(u.id); // DELETE /api/v1/employees/{id}
      reload();
    } catch (e) {
      window.alert((e && (e.payload?.detail || e.message)) || t("common.error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("usr.title")}</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setImportOpen(true)} className="sd-btn sd-btn--outline">
            <Upload size={16} /> {t("imp.btn")}
          </button>
          <button onClick={open ? close : startCreate} className="sd-btn sd-btn--gold">
            {open ? <X size={17} /> : <Plus size={17} />} {open ? t("usr.cancel") : t("usr.new")}
          </button>
        </div>
      </div>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={reload} />}

      {open && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{editingId ? t("usr.edit") : t("usr.create")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("usr.name")}</label><input className="sd-field" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Prénom Nom" /></div>
            <div><label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("usr.email")}</label><input className="sd-field" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="prenom.nom@entreprise.com" /></div>
            <div><label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("usr.password")}{editingId ? ` (${t("usr.pwdKeep")})` : ""}</label><input className="sd-field" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={editingId ? "••••••" : ""} disabled={!!editingId} /></div>
            <div><label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("usr.dept")}</label><input className="sd-field" value={form.dept} onChange={(e) => set("dept", e.target.value)} placeholder="IT, RH, Ventes…" /></div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("emp.role")}</label>
              <select className="sd-field" value={form.role} onChange={(e) => set("role", e.target.value)}>
                {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r][lang]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("emp.status")}</label>
              <select className="sd-field" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {Object.values(STATUS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s][lang]}</option>)}
              </select>
            </div>
          </div>
          {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}>{err}</div>}
          <button onClick={save} disabled={saving} className="sd-btn sd-btn--gold" style={{ marginTop: 16 }}>{saving ? t("common.loading") : (editingId ? t("usr.save") : t("usr.add"))}</button>
        </Card>
      )}

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!users.length} emptyLabel={t("usr.empty")}>
        <Card style={{ marginTop: 18, padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>{t("usr.user")}</span><span>{t("emp.role")}</span><span>{t("emp.status")}</span><span></span>
          </div>
          {users.map((u, i) => {
            const self = currentUser && u.id === currentUser.id;
            const busy = busyId === u.id;
            return (
              <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none", opacity: busy ? 0.5 : 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{u.name.charAt(0)}</span>
                  <span><span style={{ display: "block" }}>{u.name}</span><span style={{ fontSize: 11.5, color: "var(--muted)" }}>{u.email}</span></span>
                </span>
                <span><Badge tone="gold">{ROLE_LABELS[u.role]?.[lang] || u.role}</Badge></span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{STATUS_LABELS[u.status]?.[lang] || u.status}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(u)} title={t("usr.edit")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil size={15} /></button>
                  <button onClick={() => onDelete(u)} disabled={self || busy} title={t("usr.delete")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: self ? "var(--line)" : "var(--danger)", cursor: self || busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} /></button>
                </span>
              </div>
            );
          })}
        </Card>
      </AsyncBoundary>

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
