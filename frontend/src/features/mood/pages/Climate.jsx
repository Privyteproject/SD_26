import { useState } from "react";
import { ShieldCheck, MessageSquareText } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getHumeurStats, getHumeurComments } from "../../../lib/api";

const EMOJI = { 1: "☹️", 2: "😐", 3: "😊" };

export default function Climate() {
  const { t } = useI18n();
  const [week, setWeek] = useState("");
  const { data, loading, error, reload } = useAsync(async () => {
    const [stats, com] = await Promise.all([getHumeurStats(8), getHumeurComments()]);
    return { ...(stats.data || {}), comments: (com && com.data) || [] };
  });

  const d = data || {};
  const comments = (d.comments || []).filter((c) => !week || c.semaine === week);
  const dist = d.distribution;
  const total = dist ? (dist.satisfait + dist.neutre + dist.insatisfait) : 0;
  const trend = (d.trend || []).map((x) => ({ semaine: x.semaine.replace(/^\d+-/, ""), moyenne: x.moyenne }));
  const cards = dist ? [
    { emoji: "😊", label: t("mood.satisfied"), v: dist.satisfait, c: "#2e8c57" },
    { emoji: "😐", label: t("mood.neutral"), v: dist.neutre, c: "#9a6b12" },
    { emoji: "☹️", label: t("mood.unsatisfied"), v: dist.insatisfait, c: "var(--danger)" },
  ] : [];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("climate.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px", display: "flex", alignItems: "center", gap: 6 }}>
        <ShieldCheck size={15} color="var(--gold-deep)" /> {t("climate.sub")}
      </p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        {d.score_satisfaction == null ? (
          <Card style={{ color: "var(--muted)", fontSize: 14 }}>{t("climate.insufficient")} ({t("climate.min")} {d.min_n})</Card>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
              <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{d.score_sentiment != null ? t("climate.scoreEnriched") : t("climate.score")}</div>
                <div style={{ fontSize: 46, fontWeight: 700, color: "var(--ink)" }}>{d.score_global ?? d.score_satisfaction}<span style={{ fontSize: 20, color: "var(--muted)" }}>/100</span></div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{d.semaine_courante} · {d.n} {t("climate.responses")}</div>
                {d.score_sentiment != null && (
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
                    {t("climate.declarative")} : <b style={{ color: "var(--ink)" }}>{d.score_declaratif}</b> ·{" "}
                    {t("climate.sentiment")} : <b style={{ color: "var(--ink)" }}>{d.score_sentiment}</b>
                    {" "}({d.n_comments} {t("climate.opinions")})
                    <div style={{ marginTop: 2 }}>{t("climate.blendNote")}</div>
                  </div>
                )}
              </Card>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("climate.distribution")}</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {cards.map((x) => (
                    <div key={x.label} style={{ flex: 1, textAlign: "center", background: "var(--field)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 6px" }}>
                      <div style={{ fontSize: 26 }}>{x.emoji}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: x.c, marginTop: 4 }}>{x.v}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{x.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{total ? Math.round(x.v / total * 100) : 0}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("climate.trend")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                    <XAxis dataKey="semaine" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis domain={[1, 3]} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="moyenne" stroke="var(--gold)" strokeWidth={2.5} connectNulls name={t("climate.avg")} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{t("climate.scale")}</div>
            </Card>

            {/* Retours qualitatifs anonymisés */}
            <Card style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <MessageSquareText size={17} color="var(--gold-deep)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("climate.comments")}</span>
                <select value={week} onChange={(e) => setWeek(e.target.value)} className="sd-field" style={{ marginLeft: "auto", width: "auto" }}>
                  <option value="">{t("climate.allWeeks")}</option>
                  {(d.trend || []).map((x) => <option key={x.semaine} value={x.semaine}>{x.semaine}</option>)}
                </select>
              </div>
              {comments.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("climate.noComments")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {comments.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                      <span style={{ fontSize: 18, lineHeight: 1.2 }}>{EMOJI[c.niveau] || "·"}</span>
                      <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>
                        <span style={{ fontWeight: 600 }}>{c.anonyme === false && c.auteur ? c.auteur : t("climate.anonAuthor")}</span>
                        {" — "}{c.commentaire}
                        <span style={{ color: "var(--muted)", fontSize: 11.5 }}> · {c.semaine}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>{t("climate.anon")}</div>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
