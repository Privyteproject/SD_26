import { useState } from "react";
import { Check, Rocket, GraduationCap, BookOpen } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getParcours, getOnboardingRecommandations, updateTacheStatus } from "../../../lib/api";

export default function Onboarding() {
  const { t } = useI18n();
  const { currentUser } = useSession();
  const matricule = currentUser?.id;

  // Parcours + interlocuteurs RÉELS (manager, chef de département, référent RH) du collaborateur.
  const { data, loading, error, reload } = useAsync(
    async () => {
      if (!matricule) return { tasks: [], contacts: [], formations: [], documents: [] };
      const [par, rec] = await Promise.all([
        getParcours(matricule, { type: "ONBOARDING" }),
        getOnboardingRecommandations(matricule).catch(() => null),
      ]);
      const r = (rec && rec.data) || {};
      return {
        tasks: (par && par.data) || [],
        contacts: r.interlocuteurs || [],
        formations: r.formations || [],
        documents: r.documents_a_lire || [],
      };
    },
    [matricule]
  );
  const [busyId, setBusyId] = useState(null);
  const tasks = ((data && data.tasks) || []).slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const contacts = (data && data.contacts) || [];
  const formations = (data && data.formations) || [];
  const documents = (data && data.documents) || [];

  const toggle = async (tk) => {
    setBusyId(tk.id);
    try { await updateTacheStatus(tk.id, tk.status === "done" ? "todo" : "done"); reload(); }
    catch (e) { /* ignore */ }
    finally { setBusyId(null); }
  };
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
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>{t("parc.checkHint")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {tasks.map((tk) => {
                const isDone = tk.status === "done";
                const busy = busyId === tk.id;
                return (
                  <button key={tk.id} onClick={() => toggle(tk)} disabled={busy}
                    style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14, color: isDone ? "var(--muted)" : "var(--ink)", background: "transparent", border: "none", textAlign: "left", cursor: busy ? "wait" : "pointer", padding: "7px 4px", borderRadius: 8, fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1px solid ${isDone ? "var(--gold)" : "var(--line)"}`, background: isDone ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isDone && <Check size={13} color="var(--on-gold)" strokeWidth={3} />}
                    </span>
                    <span style={{ flex: 1, textDecoration: isDone ? "line-through" : "none" }}>{tk.libelle || tk.code_tache}</span>
                    {tk.date_echeance && <span style={{ fontSize: 11.5, color: "var(--muted)", flexShrink: 0 }}>{tk.date_echeance}</span>}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card style={{ alignSelf: "flex-start" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("onb.contacts")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {contacts.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.none")}</div>
              )}
              {contacts.map((cont, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>{(cont.nom || "?").charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{cont.nom}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{cont.role}{cont.poste ? ` · ${cont.poste}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recommandations d'intégration (§3.1) : formations ciblées + documents à lire */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <Card style={{ alignSelf: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
              <GraduationCap size={16} color="var(--gold-deep)" /> {t("onb.formations")}
            </div>
            {formations.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.none")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {formations.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 13.5, color: "var(--ink)", padding: "7px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                    <span>{f.titre || f.intitule || f.nom || f.code}</span>
                    {(f.duree_jours != null || f.categorie) && (
                      <span style={{ fontSize: 11.5, color: "var(--muted)", flexShrink: 0 }}>{f.categorie || ""}{f.duree_jours != null ? ` · ${f.duree_jours} j` : ""}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card style={{ alignSelf: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
              <BookOpen size={16} color="var(--gold-deep)" /> {t("onb.docsToRead")}
            </div>
            {documents.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.none")}</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7, fontSize: 13.5, color: "var(--ink)" }}>
                {documents.map((d, i) => <li key={i}>{d.titre || d.title || d.nom}</li>)}
              </ul>
            )}
          </Card>
        </div>
      </AsyncBoundary>
    </div>
  );
}
