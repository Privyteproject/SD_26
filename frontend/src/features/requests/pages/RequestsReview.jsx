import { useState } from "react";
import { Check, X } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useAsync } from "../../../lib/useAsync";
import { getAbsences, getEmployees, updateAbsenceStatus } from "../../../lib/api";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";

const tone = { pending: "warning", validated: "success", refused: "danger" };
const key = { pending: "st.pending", validated: "st.validated", refused: "st.refused" };

const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

export default function RequestsReview() {
  const { t, lang } = useI18n();
  // Rôle élevé : le backend renvoie toutes les absences. On charge aussi les
  // employés pour afficher le nom du demandeur (les absences ne portent que le matricule).
  const { data, loading, error, reload } = useAsync(async () => {
    const [abs, emps] = await Promise.all([getAbsences(), getEmployees()]);
    return { absences: (abs && abs.data) || [], employees: (emps && emps.data) || [] };
  });

  const [busyId, setBusyId] = useState(null);
  const [actErr, setActErr] = useState("");

  const nameById = {};
  for (const e of (data?.employees || [])) {
    nameById[e.id] = `${e.prenom || ""} ${e.nom || ""}`.trim() || e.email || e.id;
  }
  const sorted = [...(data?.absences || [])].sort((a, b) => (b.status === "pending") - (a.status === "pending"));

  const act = async (id, status) => {
    setBusyId(id); setActErr("");
    try {
      await updateAbsenceStatus(id, status); // PATCH /absences/{id}/status
      reload();
    } catch (e) {
      setActErr((e && (e.payload?.detail || e.message)) || t("common.error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("reqr.title")}</h1>
      {actErr && <div style={{ marginBottom: 12, fontSize: 13, color: "var(--danger)" }}>{actErr}</div>}

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!sorted.length} emptyLabel={t("reqr.empty")}>
        <Card style={{ padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 1.2fr 1fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>{t("reqr.requester")}</span><span>{t("req.type")}</span><span>{t("req.period")}</span><span>{t("req.status")}</span><span></span>
          </div>
          {sorted.map((r, i) => {
            const busy = busyId === r.id;
            return (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 1.2fr 1fr auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none", opacity: busy ? 0.5 : 1 }}>
                <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{nameById[r.employee_id] || r.employee_id}</span>
                <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{r.type}<span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{r.reason || ""}</span></span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{fmt(r.start_date, lang)} – {fmt(r.end_date, lang)}</span>
                <Badge tone={tone[r.status]}>{t(key[r.status])}</Badge>
                <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => act(r.id, "validated")} disabled={busy || r.status === "validated"} title={t("reqr.approve")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: r.status === "validated" ? "var(--line)" : "var(--success)", cursor: busy || r.status === "validated" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={16} /></button>
                  <button onClick={() => act(r.id, "refused")} disabled={busy || r.status === "refused"} title={t("reqr.refuse")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: r.status === "refused" ? "var(--line)" : "var(--danger)", cursor: busy || r.status === "refused" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
                </span>
              </div>
            );
          })}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
