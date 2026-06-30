import { useState } from "react";
import { Plus, Trash2, CalendarClock, Check } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useAsync } from "../../../lib/useAsync";
import { getMyTaches, createTache, updateTache, deleteTache } from "../../../lib/api";

const PRIO_TONE = { haute: "var(--danger)", normale: "var(--gold)", basse: "var(--muted)" };

function todayISO() {
  // pas de Date.now ici : on lit la date côté navigateur via input; comparaison string ISO
  return new Date().toISOString().slice(0, 10);
}

export default function AgendaTasks() {
  const { t } = useI18n();
  const { data, loading, reload } = useAsync(() => getMyTaches(), []);
  const [titre, setTitre] = useState("");
  const [ech, setEch] = useState("");
  const [prio, setPrio] = useState("normale");
  const [busy, setBusy] = useState(false);

  const taches = (data && data.data) || [];
  const today = todayISO();

  const add = async () => {
    if (!titre.trim()) return;
    setBusy(true);
    try {
      await createTache({ titre: titre.trim(), date_echeance: ech || null, priorite: prio });
      setTitre(""); setEch(""); setPrio("normale"); reload();
    } finally { setBusy(false); }
  };
  const toggle = async (tk) => { await updateTache(tk.id, { fait: !tk.fait }); reload(); };
  const remove = async (tk) => { await deleteTache(tk.id); reload(); };

  const actives = taches.filter((x) => !x.fait);
  const groups = [
    { key: "overdue", label: t("tasks.overdue"), tone: "var(--danger)", items: actives.filter((x) => x.date_echeance && x.date_echeance < today) },
    { key: "today", label: t("tasks.today"), tone: "var(--gold-deep)", items: actives.filter((x) => x.date_echeance === today) },
    { key: "upcoming", label: t("tasks.upcoming"), tone: "var(--info)", items: actives.filter((x) => x.date_echeance && x.date_echeance > today) },
    { key: "nodate", label: t("tasks.nodate"), tone: "var(--muted)", items: actives.filter((x) => !x.date_echeance) },
  ].filter((g) => g.items.length);
  const done = taches.filter((x) => x.fait);

  const row = (tk) => (
    <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 2px" }}>
      <button onClick={() => toggle(tk)} aria-label="toggle"
        style={{
          width: 18, height: 18, flexShrink: 0, borderRadius: 6, cursor: "pointer",
          border: `1.6px solid ${tk.fait ? "var(--success)" : "var(--line)"}`,
          background: tk.fait ? "var(--success)" : "transparent", display: "grid", placeItems: "center",
        }}>
        {tk.fait && <Check size={12} color="#fff" />}
      </button>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: PRIO_TONE[tk.priorite] || "var(--gold)", flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: tk.fait ? "var(--faint)" : "var(--ink)", textDecoration: tk.fait ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {tk.titre}
      </span>
      {tk.date_echeance && !tk.fait && <span style={{ fontSize: 11, color: "var(--muted)" }}>{tk.date_echeance.slice(5)}</span>}
      <button onClick={() => remove(tk)} aria-label="delete" className="ds-del"
        style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--faint)", padding: 2, opacity: 0.6 }}>
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="sd-card">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--r-md)", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center" }}>
          <CalendarClock size={17} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("cockpit.agenda")}</div>
      </div>

      {/* Ajout */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
        <input className="sd-field" value={titre} onChange={(e) => setTitre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} placeholder={t("tasks.placeholder")} style={{ fontSize: 13 }} />
        <div style={{ display: "flex", gap: 7 }}>
          <input type="date" className="sd-field" value={ech} onChange={(e) => setEch(e.target.value)} style={{ fontSize: 12.5, flex: 1 }} />
          <select className="sd-field" value={prio} onChange={(e) => setPrio(e.target.value)} style={{ fontSize: 12.5, width: 96 }}>
            <option value="basse">Basse</option><option value="normale">Normale</option><option value="haute">Haute</option>
          </select>
          <button onClick={add} disabled={busy || !titre.trim()} className="sd-btn sd-btn--gold sd-btn--sm" style={{ padding: "0 12px" }}>
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Listes groupées */}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {loading && <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 0" }}>{t("common.loading")}</div>}
        {!loading && taches.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 0" }}>{t("tasks.empty")}</div>}
        {groups.map((g) => (
          <div key={g.key} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: g.tone, margin: "8px 0 2px" }}>{g.label} · {g.items.length}</div>
            {g.items.map(row)}
          </div>
        ))}
        {done.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--success)", marginBottom: 2 }}>{t("tasks.done")} · {done.length}</div>
            {done.slice(0, 6).map(row)}
          </div>
        )}
      </div>
    </div>
  );
}
