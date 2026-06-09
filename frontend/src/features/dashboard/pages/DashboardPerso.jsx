import { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { MessageSquare, FileText, Rocket, LogOut, ArrowRight, Check } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { STATUS } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import {
  ENGAGEMENT_TREND, LEAVE, PENDING_REQUESTS,
  ONBOARDING_TASKS, OFFBOARDING_TASKS,
} from "../../../mock/mockData";
import { getEngagementTrend } from "../../../app/api/services";

function LifecycleCard({ tone, icon: Icon, title, sub, progress, cta, tasks, lang }) {
  return (
    <Card style={{ borderColor: "var(--gold-soft)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={20} />
        </div>
        <div>
          <div className="font-display" style={{ fontWeight: 600, color: "var(--ink)" }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{sub}</div>
        </div>
        <div style={{ marginLeft: "auto" }}><Badge tone="gold">{progress}%</Badge></div>
      </div>
      <div style={{ height: 7, background: "var(--gold-tint)", borderRadius: 6, marginTop: 16, overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--gold)" }} />
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((tk) => (
          <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: tk.done ? "var(--muted)" : "var(--ink)" }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `1px solid ${tk.done ? "var(--gold)" : "var(--line)"}`, background: tk.done ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {tk.done && <Check size={12} color="var(--on-gold)" strokeWidth={3} />}
            </span>
            <span style={{ textDecoration: tk.done ? "line-through" : "none" }}>{tk.label[lang]}</span>
          </div>
        ))}
      </div>
      <button style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "none", color: "var(--gold-deep)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", padding: 0 }}>
        {cta} <ArrowRight size={16} />
      </button>
    </Card>
  );
}

export default function DashboardPerso() {
  const { t, lang } = useI18n();
  const { status } = useSession();

  const [engagementData, setEngagementData] = useState(ENGAGEMENT_TREND);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getEngagementTrend()
      .then((res) => {
        if (!cancelled && res.data) setEngagementData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  const onbDone = ONBOARDING_TASKS.filter((x) => x.done).length;
  const onbProgress = Math.round((onbDone / ONBOARDING_TASKS.length) * 100);
  const offDone = OFFBOARDING_TASKS.filter((x) => x.done).length;
  const offProgress = Math.round((offDone / OFFBOARDING_TASKS.length) * 100);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>
        {t("dash.welcome")}, Yannick
      </h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px" }}>{t("dash.welcomeSub")}</p>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginBottom: 14 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}

      {/* Carte onboarding — visible uniquement pour un nouvel arrivant */}
      {status === STATUS.NEW && (
        <div style={{ marginTop: 22 }}>
          <LifecycleCard tone="gold" icon={Rocket} title={t("onb.title")} sub={t("onb.sub")}
            progress={onbProgress} cta={t("onb.cta")} tasks={ONBOARDING_TASKS} lang={lang} />
        </div>
      )}

      {/* Carte offboarding — visible uniquement si départ communiqué */}
      {status === STATUS.LEAVING && (
        <div style={{ marginTop: 22 }}>
          <LifecycleCard tone="gold" icon={LogOut} title={t("off.title")} sub={t("off.sub")}
            progress={offProgress} cta={t("off.cta")} tasks={OFFBOARDING_TASKS} lang={lang} />
        </div>
      )}

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 22 }}>
        <KpiCard label={t("dash.leave")} value={`${LEAVE.remaining} ${t("dash.days")}`} sub={`/ ${LEAVE.total}`} />
        <KpiCard label={t("dash.requests")} value={PENDING_REQUESTS.length} />
        <KpiCard label={t("dash.todo")} value={ONBOARDING_TASKS.filter((x) => !x.done).length} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        {/* Graphique engagement */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("dash.engagement")}</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagementData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} domain={[60, 90]} />
                <Tooltip />
                <Line type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--gold)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Demandes + accès rapides */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("dash.requests")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PENDING_REQUESTS.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5, color: "var(--ink)" }}>
                {r.label[lang]}
                <Badge tone={r.status === "validated" ? "success" : "warning"}>
                  {r.status === "validated" ? "✓" : "•"}
                </Badge>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16 }}>
            <button style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", height: 42, borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", paddingInline: 14, fontFamily: "inherit" }}>
              <MessageSquare size={17} /> {t("dash.askAi")}
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", height: 42, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", paddingInline: 14, fontFamily: "inherit" }}>
              <FileText size={17} /> {t("dash.genDoc")}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
