import { useState } from "react";
import { Megaphone, Pin, Check } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getMyAnnonces, markAnnonceRead } from "../../../lib/api";

function when(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function News() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => (await getMyAnnonces()).data || []);
  const items = data || [];
  const [busy, setBusy] = useState(null);

  const markRead = async (id) => {
    setBusy(id);
    try { await markAnnonceRead(id); reload(); } catch (e) { /* ignore */ } finally { setBusy(null); }
  };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("news.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{t("news.sub")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!items.length} emptyLabel={t("news.empty")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          {items.map((a) => (
            <Card key={a.id} style={!a.lu ? { borderLeft: "3px solid var(--gold)" } : { opacity: 0.92 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <Megaphone size={17} color="var(--gold-deep)" />
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{a.titre}</span>
                {a.epingle && <Badge tone="warning"><Pin size={11} /> {t("news.pinned")}</Badge>}
                {!a.lu && <Badge tone="gold">{t("news.new")}</Badge>}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{when(a.date_creation, lang)}</span>
              </div>
              <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.contenu}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{a.auteur || "RH"}</span>
                {!a.lu && (
                  <button onClick={() => markRead(a.id)} disabled={busy === a.id}
                    style={{ marginLeft: "auto", height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Check size={14} /> {t("news.markRead")}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </AsyncBoundary>
    </div>
  );
}
