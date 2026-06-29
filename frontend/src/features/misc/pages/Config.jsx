import { useState } from "react";
import { FileText, ShieldCheck, Plus, X } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getSupervisionRules, setSupervisionRules } from "../../../lib/api";

const SOURCES = ["Convention collective.pdf", "Règlement intérieur.pdf", "Politique de congés.pdf", "Procédures RH.pdf"];
const GUARDRAILS = [
  { fr: "Refus des données hors périmètre du rôle", en: "Deny data outside role scope" },
  { fr: "Détection de tentatives de contournement", en: "Detect bypass attempts" },
  { fr: "Journalisation des requêtes sensibles", en: "Log sensitive requests" },
];

export default function Config() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => (await getSupervisionRules()).data || {});
  const socle = data?.mots_sensibles_socle || [];
  const [extra, setExtra] = useState(null);     // null tant que non édité → on lit la valeur serveur
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const list = extra ?? (data?.mots_sensibles_extra || []);

  const add = () => {
    const w = word.trim().toLowerCase();
    if (!w || list.includes(w)) { setWord(""); return; }
    setExtra([...list, w]); setWord(""); setSaved(false);
  };
  const remove = (w) => { setExtra(list.filter((x) => x !== w)); setSaved(false); };
  const save = async () => {
    setBusy(true); setSaved(false);
    try { const r = await setSupervisionRules({ mots_sensibles_extra: list }); setExtra(r.data.mots_sensibles_extra); setSaved(true); reload(); }
    catch (e) { window.alert((e && (e.payload?.detail || e.message)) || "Erreur"); } finally { setBusy(false); }
  };

  const chip = (w, onX) => (
    <span key={w} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-deep)", border: "1px solid #E0CFA3", fontSize: 12.5, fontWeight: 600 }}>
      {w}{onX && <button onClick={() => onX(w)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", padding: 0 }}><X size={12} /></button>}
    </span>
  );

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("cfg.title")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("cfg.sources")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SOURCES.map((sname) => (
              <div key={sname} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink)" }}>
                <FileText size={16} color="var(--gold-deep)" /> {sname}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("cfg.guardrails")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GUARDRAILS.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink)" }}>
                <ShieldCheck size={16} color="var(--gold-deep)" /> {g[lang]}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Règles de supervision configurables (mots-clés sensibles) */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
          <ShieldCheck size={16} color="var(--gold-deep)" /> {t("cfg.rulesTitle")}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>{t("cfg.rulesSub")}</p>
        <AsyncBoundary loading={loading} error={error} onRetry={reload}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{t("cfg.builtins")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, opacity: 0.85 }}>
            {socle.map((w) => chip(w))}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{t("cfg.extra")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {list.length === 0 ? <span style={{ fontSize: 13, color: "var(--muted)" }}>{t("cfg.noExtra")}</span> : list.map((w) => chip(w, remove))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={t("cfg.addKeyword")} className="sd-field" style={{ maxWidth: 280 }} />
            <button onClick={add} className="sd-btn sd-btn--outline sd-btn--sm"><Plus size={15} /> {t("cfg.add")}</button>
            <button onClick={save} disabled={busy} className="sd-btn sd-btn--gold sd-btn--sm" style={{ marginLeft: "auto" }}>{busy ? "…" : t("cfg.save")}</button>
            {saved && <span style={{ fontSize: 12.5, color: "#2e8c57", fontWeight: 600 }}>{t("cfg.saved")}</span>}
          </div>
        </AsyncBoundary>
      </Card>
    </div>
  );
}
