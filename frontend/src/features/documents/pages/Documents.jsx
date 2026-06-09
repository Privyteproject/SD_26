import { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import { FileText, Download, ArrowRight } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { DOCUMENT_TYPES, DOCUMENT_HISTORY } from "../../../mock/mockData";
import { getDocuments } from "../../../app/api/services";

const statusTone = { validated: "success", pending: "warning", refused: "danger", draft: "info" };
const statusKey = { validated: "st.validated", pending: "st.pending", refused: "st.refused", draft: "st.draft" };

export default function Documents() {
  const { t, lang } = useI18n();
  const [selected, setSelected] = useState(DOCUMENT_TYPES[0].id);
  const current = DOCUMENT_TYPES.find((d) => d.id === selected);
  const [history, setHistory] = useState(DOCUMENT_HISTORY);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getDocuments()
      .then((res) => {
        if (cancelled) return;
        const mapped = (res.data || []).map((d) => ({
          id: d.id,
          name: { fr: d.title || d.type, en: d.title || d.type },
          date: d.uploaded_at?.slice(0, 10) || "—",
          status: "validated",
        }));
        if (mapped.length > 0) setHistory(mapped);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("docs.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>{t("docs.pick")}</p>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginTop: 10 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}

      {/* Type selector */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 20 }}>
        {DOCUMENT_TYPES.map((d) => {
          const Icon = Icons[d.icon] || FileText;
          const active = d.id === selected;
          return (
            <button key={d.id} onClick={() => setSelected(d.id)}
              style={{ textAlign: "left", cursor: "pointer", background: "var(--surface)", padding: 18, borderRadius: 14,
                border: `1px solid ${active ? "var(--gold)" : "var(--line)"}`, fontFamily: "inherit" }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "var(--gold)" : "var(--gold-tint)", color: active ? "var(--on-gold)" : "var(--gold-deep)" }}>
                <Icon size={20} />
              </div>
              <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{d.name[lang]}</div>
            </button>
          );
        })}
      </div>

      {/* Form + Preview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{current.name[lang]}</div>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t("docs.field.reason")}</label>
          <input placeholder="…" style={{ width: "100%", height: 44, marginTop: 6, marginBottom: 14, borderRadius: 10, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", outline: "none", fontFamily: "inherit", fontSize: 14 }} />
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t("docs.field.period")}</label>
          <input placeholder="…" style={{ width: "100%", height: 44, marginTop: 6, borderRadius: 10, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", outline: "none", fontFamily: "inherit", fontSize: 14 }} />
          <button style={{ marginTop: 18, width: "100%", height: 46, borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
            {t("docs.submit")} <ArrowRight size={18} />
          </button>
        </Card>

        <Card style={{ background: "var(--panel)", borderColor: "var(--panel-line)" }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--panel-muted)", marginBottom: 12 }}>{t("docs.preview")}</div>
          <div style={{ background: "var(--surface)", borderRadius: 10, padding: 18, minHeight: 200 }}>
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>{current.name[lang]}</div>
            <div style={{ height: 1, background: "var(--line)", margin: "12px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[80, 95, 70, 88, 60].map((w, i) => (
                <div key={i} style={{ height: 8, width: `${w}%`, background: "var(--gold-tint)", borderRadius: 4 }} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* History */}
      <div style={{ marginTop: 24, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("docs.history")}</div>
      <Card style={{ marginTop: 10, padding: 0 }}>
        {history.map((d, i) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={17} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{d.name[lang]}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.date}</div>
            </div>
            <Badge tone={statusTone[d.status]}>{t(statusKey[d.status])}</Badge>
            <button aria-label="download" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Download size={16} /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}
