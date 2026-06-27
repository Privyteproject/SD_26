import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { MessageSquare, FileText, Rocket, LogOut, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { STATUS } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import { useAsync } from "../../../lib/useAsync";
import { getAbsences, getParcours } from "../../../lib/api";
import { ENGAGEMENT_TREND, LEAVE } from "../../../mock/mockData";

const tone = { pending: "warning", validated: "success", refused: "danger" };
const key = { pending: "st.pending", validated: "st.validated", refused: "st.refused" };

// Carte de cycle de vie alimentée par les VRAIES tâches du parcours (lecture seule).
function LifecycleCard({ icon: Icon, title, sub, progress, cta, tasks, onCta }) {
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
        {tasks.map((tk) => {
          const isDone = tk.status === "done";
          return (
            <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: isDone ? "var(--muted)" : "var(--ink)" }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `1px solid ${isDone ? "var(--gold)" : "var(--line)"}`, background: isDone ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isDone && <Check size={12} color="var(--on-gold)" strokeWidth={3} />}
              </span>
              <span style={{ textDecoration: isDone ? "line-through" : "none" }}>{tk.libelle || tk.code_tache}</span>
            </div>
          );
        })}
      </div>
      <button onClick={onCta} className="sd-btn sd-btn--ghost sd-btn--sm" style={{ marginTop: 16 }}>
        {cta} <ArrowRight size={16} />
      </button>
    </Card>
  );
}

export default function DashboardPerso() {
  const { t, lang } = useI18n();
  const { status, currentUser } = useSession();
  const navigate = useNavigate();
  const matricule = currentUser?.id;

  // Type de parcours pertinent selon le statut du collaborateur.
  const lifecycleType = status === STATUS.NEW ? "ONBOARDING" : status === STATUS.LEAVING ? "OFFBOARDING" : null;

  // Données réelles : absences + tâches du parcours en cours.
  const { data, loading } = useAsync(async () => {
    const [abs, par] = await Promise.all([
      getAbsences(),
      lifecycleType && matricule ? getParcours(matricule, { type: lifecycleType }) : Promise.resolve({ data: [] }),
    ]);
    return { absences: (abs && abs.data) || [], tasks: (par && par.data) || [] };
  }, [matricule, lifecycleType]);

  const absences = data?.absences || [];
  const tasks = (data?.tasks || []).slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const pendingCount = absences.filter((a) => a.status === "pending").length;
  const todoCount = tasks.filter((t) => t.status !== "done").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const recent = absences.slice(0, 4);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>
        {t("dash.welcome")}, {currentUser?.name?.split(" ")[0] || ""}
      </h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>{t("dash.welcomeSub")}</p>

      {/* Carte cycle de vie : vraies tâches du parcours */}
      {lifecycleType && (
        <div style={{ marginTop: 22 }}>
          {tasks.length > 0 ? (
            <LifecycleCard
              icon={lifecycleType === "ONBOARDING" ? Rocket : LogOut}
              title={lifecycleType === "ONBOARDING" ? t("onb.title") : t("off.title")}
              sub={lifecycleType === "ONBOARDING" ? t("onb.sub") : t("off.sub")}
              progress={progress}
              cta={lifecycleType === "ONBOARDING" ? t("onb.cta") : t("off.cta")}
              tasks={tasks}
              onCta={() => navigate(lifecycleType === "ONBOARDING" ? "/app/onboarding" : "/app/offboarding")}
            />
          ) : (
            <Card style={{ borderColor: "var(--gold-soft)", color: "var(--muted)", fontSize: 14 }}>
              {t("parc.noParcours")}
            </Card>
          )}
        </div>
      )}

      {/* KPI : "Demandes en cours" et "À faire" sont RÉELS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 22 }}>
        <KpiCard label={t("dash.leave")} value={`${LEAVE.remaining} ${t("dash.days")}`} sub={`/ ${LEAVE.total}`} />
        <KpiCard label={t("dash.requests")} value={loading ? "…" : pendingCount} />
        <KpiCard label={t("dash.todo")} value={loading ? "…" : todoCount} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("dash.engagement")}</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ENGAGEMENT_TREND} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} domain={[60, 90]} />
                <Tooltip />
                <Line type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--gold)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Demandes réelles + accès rapides */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("dash.requests")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>
            ) : recent.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("req.empty")}</div>
            ) : recent.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13.5, color: "var(--ink)" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.type}</span>
                <Badge tone={tone[r.status]}>{t(key[r.status])}</Badge>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16 }}>
            <button onClick={() => navigate("/app/assistant")} className="sd-btn sd-btn--gold" style={{ width: "100%" }}>
              <MessageSquare size={17} /> {t("dash.askAi")}
            </button>
            <button onClick={() => navigate("/app/documents")} className="sd-btn sd-btn--outline" style={{ width: "100%" }}>
              <FileText size={17} /> {t("dash.genDoc")}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
