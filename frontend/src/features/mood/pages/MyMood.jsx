import { useState, useEffect } from "react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getMyHumeur, submitHumeur } from "../../../lib/api";

const MOODS = [
  { n: 3, emoji: "😊", key: "mood.satisfied" },
  { n: 2, emoji: "😐", key: "mood.neutral" },
  { n: 1, emoji: "☹️", key: "mood.unsatisfied" },
];

export default function MyMood() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => (await getMyHumeur()).data);
  const [niveau, setNiveau] = useState(0);
  const [comment, setComment] = useState("");
  const [anonyme, setAnonyme] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (data) {
      setNiveau(data.niveau || 0);
      setComment(data.commentaire || "");
      if (typeof data.anonyme === "boolean") setAnonyme(data.anonyme);
    }
  }, [data]);

  const submit = async () => {
    if (!niveau) return;
    setBusy(true); setDone(false);
    try { await submitHumeur({ niveau, commentaire: comment || null, anonyme }); setDone(true); reload(); }
    catch (e) { /* ignore */ } finally { setBusy(false); }
  };

  const area = { width: "100%", minHeight: 80, borderRadius: 10, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: 12, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("mood.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{t("mood.sub")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <Card style={{ maxWidth: 520 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("mood.question")}</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {MOODS.map((m) => {
              const active = niveau === m.n;
              return (
                <button key={m.n} onClick={() => setNiveau(m.n)} style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: `2px solid ${active ? "var(--gold)" : "var(--line)"}`, background: active ? "var(--gold-tint)" : "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{m.emoji}</span>
                  <span style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: active ? 600 : 400 }}>{t(m.key)}</span>
                </button>
              );
            })}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("mood.commentPlaceholder")} style={area} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
            <input type="checkbox" checked={anonyme} onChange={(e) => setAnonyme(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--gold)", cursor: "pointer" }} />
            {t("mood.anon")}
          </label>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{anonyme ? t("mood.anonOn") : t("mood.anonOff")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <button onClick={submit} disabled={busy || !niveau} style={{ height: 42, padding: "0 20px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14.5, cursor: "pointer", opacity: !niveau ? 0.6 : 1, fontFamily: "inherit" }}>
              {busy ? "…" : (data ? t("mood.update") : t("mood.send"))}
            </button>
            {done && <span style={{ fontSize: 13, color: "#2e8c57", fontWeight: 600 }}>{t("mood.thanks")}</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 16, lineHeight: 1.5 }}>{t("mood.privacy")}</div>
        </Card>
      </AsyncBoundary>
    </div>
  );
}
