import { useState, useEffect } from "react";
import { FileText, Download, ArrowRight } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDocuments, getDocumentModeles, createDocument, downloadDocument } from "../../../lib/api";

const statusTone = { validated: "success", pending: "warning", refused: "danger", draft: "info" };
const statusKey = { validated: "st.validated", pending: "st.pending", refused: "st.refused", draft: "st.draft" };

const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

export default function Documents() {
  const { t, lang } = useI18n();

  const { data, loading, error, reload } = useAsync(async () => {
    const [docs, modeles] = await Promise.all([getDocuments(), getDocumentModeles()]);
    return { docs: (docs && docs.data) || [], modeles: (modeles && modeles.data) || [] };
  });
  const docs = data?.docs || [];
  const modeles = data?.modeles || [];

  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [dlId, setDlId] = useState(null);
  const [msg, setMsg] = useState("");

  // Sélectionne le 1er modèle dès qu'ils sont chargés.
  useEffect(() => {
    if (modeles.length && !modeles.some((m) => m.code === selected)) setSelected(modeles[0].code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const current = modeles.find((m) => m.code === selected);

  const generate = async () => {
    if (!selected) return;
    setBusy(true); setMsg("");
    try {
      await createDocument({ code_modele: selected }); // POST /documents (employé = soi par défaut)
      reload();
    } catch (e) {
      setMsg((e && (e.payload?.detail || e.message)) || t("common.error"));
    } finally { setBusy(false); }
  };

  const download = async (id) => {
    setDlId(id); setMsg("");
    try {
      await downloadDocument(id); // GET /documents/{id}/download (Bearer + ownership)
    } catch (e) {
      setMsg((e && (e.payload?.detail || e.message)) || t("common.error"));
    } finally { setDlId(null); }
  };

  const field = { width: "100%", height: 44, marginTop: 6, borderRadius: 10, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", outline: "none", fontFamily: "inherit", fontSize: 14 };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("docs.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>{t("docs.pick")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        {/* Choix du modèle (depuis GET /documents/modeles) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 20 }}>
          {modeles.map((m) => {
            const active = m.code === selected;
            return (
              <button key={m.code} onClick={() => setSelected(m.code)} style={{ textAlign: "left", cursor: "pointer", background: "var(--surface)", padding: 18, borderRadius: 14, border: `1px solid ${active ? "var(--gold)" : "var(--line)"}`, fontFamily: "inherit" }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--gold)" : "var(--gold-tint)", color: active ? "var(--on-gold)" : "var(--gold-deep)" }}><FileText size={20} /></div>
                <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{m.libelle}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{current?.libelle || t("docs.gen")}</div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t("docs.pick")}</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} style={field}>
              {modeles.map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
            </select>
            {msg && <div style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{msg}</div>}
            <button onClick={generate} disabled={busy || !selected} style={{ marginTop: 18, width: "100%", height: 46, borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14.5, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
              {busy ? t("common.loading") : t("docs.submit")} <ArrowRight size={18} />
            </button>
          </Card>

          <Card style={{ background: "var(--panel)", borderColor: "var(--panel-line)" }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--panel-muted)", marginBottom: 12 }}>{t("docs.preview")}</div>
            <div style={{ background: "var(--surface)", borderRadius: 10, padding: 18, minHeight: 180 }}>
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>{current?.libelle || "—"}</div>
              <div style={{ height: 1, background: "var(--line)", margin: "12px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[80, 95, 70, 88, 60].map((w, i) => <div key={i} style={{ height: 8, width: `${w}%`, background: "var(--gold-tint)", borderRadius: 4 }} />)}
              </div>
            </div>
          </Card>
        </div>

        {/* Historique réel (GET /documents) */}
        <div style={{ marginTop: 24, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("docs.history")}</div>
        <Card style={{ marginTop: 10, padding: 0 }}>
          {docs.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>{t("docs.empty")}</div>
          ) : docs.map((d, i) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={17} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nom_fichier}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(d.date_creation, lang)}</div>
              </div>
              <Badge tone={statusTone[d.statut] || "info"}>{t(statusKey[d.statut] || "st.pending")}</Badge>
              <button onClick={() => download(d.id)} disabled={dlId === d.id} aria-label="download" title={t("docs.download")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", cursor: dlId === d.id ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Download size={16} /></button>
            </div>
          ))}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
