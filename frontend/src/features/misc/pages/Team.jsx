import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { EMPLOYEES, HEADCOUNT_BY_DEPT } from "../../../mock/mockData";
import { getEmployees, getHeadcount } from "../../../app/api/services";

export default function Team() {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const isManager = role === ROLES.MANAGER;

  const [employeesData, setEmployeesData] = useState(EMPLOYEES.slice(0, 4));
  const [headcountData, setHeadcountData] = useState(HEADCOUNT_BY_DEPT);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        if (isManager) {
          const res = await getEmployees();
          if (!cancelled && res.data) {
            setEmployeesData(
              res.data.slice(0, 4).map((e) => ({
                id: e.id,
                name: `${e.first_name} ${e.last_name}`,
                dept: e.department_id || "Unassigned",
                role: { fr: e.position || "Employee", en: e.position || "Employee" },
                status: e.status
              }))
            );
          }
        } else {
          const res = await getHeadcount();
          if (!cancelled && res.data) setHeadcountData(res.data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [isManager]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("team.title")}</h1>
        <Badge tone="gold">{isManager ? t("scope.team") : t("scope.org")}</Badge>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginBottom: 14 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}

      {isManager ? (
        <Card style={{ padding: 0 }}>
          {employeesData.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{e.name.charAt(0)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{e.role[lang]} · {e.dept}</div>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("team.aggr")}</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={headcountData} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
                <XAxis dataKey="d" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="v" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
