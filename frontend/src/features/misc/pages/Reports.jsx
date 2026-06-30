import { useState } from "react";
import { FileBarChart, Download, FileCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import { downloadReport } from "../../../lib/api";
import { REPORTS } from "../../../mock/mockData";

export default function Reports() {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const download = async () => {
    setBusy(true); setMsg("");
    try { await downloadReport(); }
    catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("rep.title")}</h1>

      {/* Rapport RH certifié (PDF réel : KPIs + alertes) */}
      <Card style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 16, borderColor: "var(--gold)" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileCheck size={22} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t("rep.certified")}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("rep.certifiedSub")}</div>
          {msg && <div style={{ fontSize: 13, color: "var(--danger)", marginTop: 4 }}>{msg}</div>}
        </div>
        <button onClick={download} disabled={busy} className="sd-btn sd-btn--gold">
          <Download size={17} /> {busy ? t("common.loading") : t("rep.download")}
        </button>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {REPORTS.map((r) => (
          <Card key={r.id}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileBarChart size={20} /></div>
            <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{r.name[lang]}</div>
            <button className="sd-btn sd-btn--outline" style={{ marginTop: 14 }}>
              <Download size={15} color="var(--gold-deep)" /> {t("rep.export")}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
