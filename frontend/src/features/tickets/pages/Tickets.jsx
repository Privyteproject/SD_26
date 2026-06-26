import { useState } from "react";
import { Ticket as TicketIcon } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { RH_SPACE_ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getTickets, setTicketStatus } from "../../../lib/api";

const STATUTS = ["Nouveau", "En cours", "Résolu"];
const TONE = { "Nouveau": "warning", "En cours": "info", "Résolu": "success" };

export default function Tickets() {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const canManage = [...RH_SPACE_ROLES].includes(role);
  const { data, loading, error, reload } = useAsync(async () => (await getTickets()).data || []);
  const [busy, setBusy] = useState(null);

  const change = async (id, statut) => {
    setBusy(id);
    try { await setTicketStatus(id, statut); reload(); } catch (e) { /* ignore */ } finally { setBusy(null); }
  };
  const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");
  const tickets = data || [];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("tickets.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{canManage ? t("tickets.subRh") : t("tickets.subMe")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!tickets.length} emptyLabel={t("tickets.empty")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tickets.map((tk) => {
            const lines = (tk.reason || "").split("\n");
            const sujet = lines[0] || `Ticket #${tk.id}`;
            const desc = lines.slice(1).join("\n").trim();
            const st = tk.ticket_statut || "Nouveau";
            return (
              <Card key={tk.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, opacity: busy === tk.id ? 0.5 : 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <TicketIcon size={19} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>#{tk.id} · {sujet}</div>
                  {desc && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3, whiteSpace: "pre-wrap" }}>{desc}</div>}
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{canManage ? `${tk.employee_id} · ` : ""}{fmt(tk.date_depot)}</div>
                </div>
                {canManage ? (
                  <select value={st} disabled={busy === tk.id} onChange={(e) => change(tk.id, e.target.value)}
                    style={{ height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                    {STATUTS.map((s) => <option key={s} value={s}>{t(`tickets.st.${s}`)}</option>)}
                  </select>
                ) : (
                  <Badge tone={TONE[st] || "info"}>{t(`tickets.st.${st}`)}</Badge>
                )}
              </Card>
            );
          })}
        </div>
      </AsyncBoundary>
    </div>
  );
}
