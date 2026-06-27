import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getEmployees } from "../../../lib/api";

const PAGE_SIZE = 100;

// Récupère TOUS les employés visibles (toutes les pages) — pour l'agrégat RH/Direction.
async function fetchAllEmployees() {
  const first = await getEmployees({ page: 1, page_size: PAGE_SIZE });
  const total = (first.meta && first.meta.total) || (first.data || []).length;
  const pages = Math.ceil(total / PAGE_SIZE);
  let rows = first.data || [];
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, k) => getEmployees({ page: k + 2, page_size: PAGE_SIZE }))
    );
    rows = rows.concat(...rest.map((r) => r.data || []));
  }
  return rows;
}

export default function Team() {
  const { t } = useI18n();
  const { role } = useSession();
  const isManager = role === ROLES.MANAGER;
  const [page, setPage] = useState(1);

  // Manager : liste paginée de son équipe (le backend la restreint à son département).
  // RH/Direction : toutes les pages pour un agrégat exact par département.
  const { data, loading, error, reload } = useAsync(
    () => (isManager ? getEmployees({ page, page_size: PAGE_SIZE }) : fetchAllEmployees()),
    [isManager, page]
  );

  const team = isManager ? (data && data.data) || [] : [];
  const total = isManager ? (data && data.meta && data.meta.total) || 0 : (data || []).length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const all = isManager ? [] : data || [];

  const byDept = Object.values(
    all.reduce((acc, e) => {
      const d = e.department || e.department_id || "—";
      acc[d] = acc[d] || { d, v: 0 };
      acc[d].v += 1;
      return acc;
    }, {})
  );

  const navBtn = (disabled) => ({ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: disabled ? 0.5 : 1 });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("team.title")}</h1>
        <Badge tone="gold">{isManager ? t("scope.team") : t("scope.org")}</Badge>
        {total > 0 && <Badge tone="info">{total}</Badge>}
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={isManager ? !team.length : !all.length} emptyLabel={t("emp.empty")}>
        {isManager ? (
          <>
            <Card style={{ marginTop: 18, padding: 0 }}>
              {team.map((e, i) => {
                const name = `${e.prenom || ""} ${e.nom || ""}`.trim() || e.email || "—";
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                    <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{name.charAt(0)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{e.poste || "—"} · {e.department || e.department_id || "—"}</div>
                    </div>
                  </div>
                );
              })}
            </Card>
            {pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 16 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} style={navBtn(page <= 1 || loading)}>{t("emp.prev")}</button>
                <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{t("emp.page")} {page} / {pages}</span>
                <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages || loading} style={navBtn(page >= pages || loading)}>{t("emp.next")}</button>
              </div>
            )}
          </>
        ) : (
          <Card style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("team.aggr")}</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDept} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
                  <XAxis dataKey="d" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="v" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </AsyncBoundary>
    </div>
  );
}
