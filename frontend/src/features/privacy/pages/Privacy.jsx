import { useState } from "react";
import { ShieldCheck, Lock, Download, Trash2, Database, Scale, Users, Clock } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getMyPrivacy, setMyConsent, exportMyData, requestErasure } from "../../../lib/api";

export default function Privacy() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => (await getMyPrivacy()).data || []);
  const finalites = data || [];
  const [busy, setBusy] = useState(false);

  const toggle = async (finalite, accorde) => {
    setBusy(true);
    try { await setMyConsent({ finalite, accorde }); reload(); }
    catch (e) { window.alert((e && (e.payload?.detail || e.message)) || "Erreur"); } finally { setBusy(false); }
  };
  const doExport = async () => {
    setBusy(true);
    try {
      const res = await exportMyData();
      const blob = new Blob([JSON.stringify(res.data || {}, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "mes-donnees-synapse.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { window.alert((e && (e.payload?.detail || e.message)) || "Erreur"); } finally { setBusy(false); }
  };
  const doErasure = async () => {
    if (!window.confirm(t("privacy.erasureConfirm"))) return;
    setBusy(true);
    try { await requestErasure(); window.alert(t("privacy.erasureSent")); }
    catch (e) { window.alert((e && (e.payload?.detail || e.message)) || "Erreur"); } finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("privacy.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px", display: "flex", alignItems: "center", gap: 6 }}>
        <ShieldCheck size={15} color="var(--gold-deep)" /> {t("privacy.sub")}
      </p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ opacity: busy ? 0.7 : 1, display: "flex", flexDirection: "column", gap: 16, maxWidth: 880 }}>
          {/* Finalités + consentement */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("privacy.purposes")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {finalites.map((f) => (
                <div key={f.key} style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{f.nom}</span>
                    {f.revocable
                      ? <Badge tone={f.accorde ? "success" : "warning"}>{f.accorde ? t("privacy.granted") : t("privacy.withdrawn")}</Badge>
                      : <Badge tone="info">{t("privacy.mandatory")}</Badge>}
                    {f.revocable && (
                      <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!f.accorde} disabled={busy} onChange={(e) => toggle(f.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--gold)", cursor: "pointer" }} />
                        {t("privacy.consent")}
                      </label>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "4px 18px", marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>
                    <span><Database size={12} style={{ verticalAlign: "-2px" }} /> {t("privacy.data")} : <span style={{ color: "var(--ink)" }}>{f.donnees}</span></span>
                    <span><ShieldCheck size={12} style={{ verticalAlign: "-2px" }} /> {t("privacy.goal")} : <span style={{ color: "var(--ink)" }}>{f.finalite}</span></span>
                    <span><Scale size={12} style={{ verticalAlign: "-2px" }} /> {t("privacy.legal")} : <span style={{ color: "var(--ink)" }}>{f.base_legale}</span></span>
                    <span><Users size={12} style={{ verticalAlign: "-2px" }} /> {t("privacy.access")} : <span style={{ color: "var(--ink)" }}>{f.acces}</span></span>
                    <span><Clock size={12} style={{ verticalAlign: "-2px" }} /> {t("privacy.retention")} : <span style={{ color: "var(--ink)" }}>{f.conservation}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Mes droits */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
              <Lock size={16} color="var(--gold-deep)" /> {t("privacy.rights")}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>{t("privacy.rightsSub")}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={doExport} disabled={busy} className="sd-btn sd-btn--outline">
                <Download size={16} /> {t("privacy.export")}
              </button>
              <button onClick={doErasure} disabled={busy} className="sd-btn sd-btn--danger">
                <Trash2 size={16} /> {t("privacy.erasure")}
              </button>
            </div>
          </Card>
        </div>
      </AsyncBoundary>
    </div>
  );
}
