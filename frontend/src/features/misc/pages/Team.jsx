import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getEmployees } from "../../../lib/api";

export default function Team() {
  const { t, lang } = useI18n();
  const { role, currentUser } = useSession();
  const isManager = role === ROLES.MANAGER;

  const { data, loading, error, reload } = useAsync(() => getEmployees());
  const all = (data && data.data) || [];

  // Vue manager : ses rattachés si la hiérarchie est renseignée, sinon l'ensemble visible.
  const myTeam = all.filter((e) => e.manager_matricule && e.manager_matricule === currentUser?.id);
  const team = isManager ? (myTeam.length ? myTeam : all) : all;

  // Vue RH/Direction : effectif par département agrégé depuis la liste réelle.
  const byDept = Object.values(
    all.reduce((acc, e) => {
      const d = e.department || e.department_id || "—";
      acc[d] = acc[d] || { d, v: 0 };
      acc[d].v += 1;
      return acc;
    }, {})
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("team.title")}</h1>
        <Badge tone="gold">{isManager ? t("scope.team") : t("scope.org")}</Badge>
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!all.length} emptyLabel={t("emp.empty")}>
        {isManager ? (
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
