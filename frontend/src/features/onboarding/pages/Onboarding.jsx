import { Check, Rocket } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getParcours } from "../../../lib/api";
import { ONBOARDING_CONTACTS } from "../../../mock/mockData";

export default function Onboarding() {
  const { t, lang } = useI18n();
  const { currentUser } = useSession();
  const matricule = currentUser?.id;

  // Parcours d'onboarding de l'utilisateur courant (consultation autorisée pour lui-même).
  const { data, loading, error, reload } = useAsync(
    () => (matricule ? getParcours(matricule, { type: "ONBOARDING" }) : Promise.resolve({ data: [] })),
    [matricule]
  );
  const tasks = ((data && data.data) || []).slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const done = tasks.filter((x) => x.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("onb.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>{t("onb.sub")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!tasks.length} emptyLabel={t("parc.noParcours")}>
        <Card style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16, borderColor: "var(--gold-soft)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Rocket size={20} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("onb.progress")}</div>
            <div style={{ height: 8, background: "var(--gold-tint)", borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "var(--gold)" }} />
            </div>
          </div>
          <Badge tone="gold">{progress}%</Badge>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginTop: 16 }}>
          <Card style={{ alignSelf: "flex-start" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{t("parc.tasks")}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>{t("parc.readonly")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {tasks.map((tk) => {
                const isDone = tk.status === "done";
                return (
                  <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14, color: isDone ? "var(--muted)" : "var(--ink)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1px solid ${isDone ? "var(--gold)" : "var(--line)"}`, background: isDone ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isDone && <Check size={13} color="var(--on-gold)" strokeWidth={3} />}
                    </span>
                    <span style={{ textDecoration: isDone ? "line-through" : "none" }}>{tk.libelle || tk.code_tache}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{ alignSelf: "flex-start" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("onb.contacts")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {ONBOARDING_CONTACTS.map((cont) => (
                <div key={cont.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>{cont.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{cont.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{cont.role[lang]}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </AsyncBoundary>
    </div>
  );
}
