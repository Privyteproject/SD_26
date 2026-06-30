import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity, UserPlus, Heart, Target, Award, X, ChevronRight,
  LayoutGrid, Route, HeartPulse, CalendarClock,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  LineChart, Line, ScatterChart, Scatter, CartesianGrid,
} from "recharts";

/* Palette de tons alignée sur la charte (tokens synapse-ui). */
const TONE = {
  success: { c: "var(--success)", bg: "var(--success-bg)" },
  warning: { c: "var(--warning)", bg: "var(--warning-bg)" },
  danger: { c: "var(--danger)", bg: "var(--danger-bg)" },
  info: { c: "var(--info)", bg: "var(--info-bg)" },
  gold: { c: "var(--gold-deep)", bg: "var(--gold-tint)" },
};
const ICONS = {
  activity: Activity, userPlus: UserPlus, heart: Heart, target: Target, award: Award,
  layoutGrid: LayoutGrid, route: Route, heartPulse: HeartPulse, calendarClock: CalendarClock,
};

/* Styles (keyframes + hover) injectés une seule fois. */
const CSS = `
@keyframes ov-rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
@keyframes ov-pop { from { opacity:0; transform:translateY(18px) scale(.96); } to { opacity:1; transform:none; } }
@keyframes ov-fade { from { opacity:0; } to { opacity:1; } }
@keyframes ov-bar { from { width:0; } }
.ov-block { animation: ov-rise .5s cubic-bezier(.22,.61,.36,1) both; }
.ov-card { position:relative; cursor:pointer; border:1px solid var(--line); border-radius:var(--r-lg);
  background:var(--surface); padding:18px 18px 16px; overflow:hidden; isolation:isolate;
  box-shadow:var(--shadow-sm); transition:transform .22s cubic-bezier(.22,.61,.36,1), box-shadow .22s, border-color .22s;
  animation: ov-rise .5s cubic-bezier(.22,.61,.36,1) both; }
.ov-card:hover { transform:translateY(-5px); box-shadow:var(--shadow-lg); border-color:var(--gold-soft); }
.ov-card:hover .ov-cta { opacity:1; transform:none; }
.ov-card::after { content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:var(--tone-c);
  transform:scaleX(0); transform-origin:left; transition:transform .3s ease; }
.ov-card:hover::after { transform:scaleX(1); }
.ov-cta { opacity:0; transform:translateX(-4px); transition:opacity .22s, transform .22s; }
.ov-backdrop { position:fixed; inset:0; z-index:60; background:rgba(36,27,16,.46);
  backdrop-filter:blur(7px) saturate(.9); -webkit-backdrop-filter:blur(7px) saturate(.9);
  display:flex; align-items:center; justify-content:center; padding:24px; animation: ov-fade .22s ease both; }
.ov-panel { width:min(660px,100%); max-height:88vh; overflow:auto; background:var(--surface);
  border:1px solid var(--line); border-radius:var(--r-xl); box-shadow:var(--shadow-lg);
  animation: ov-pop .34s cubic-bezier(.22,.61,.36,1) both; }
.ov-distrow > i { display:block; height:100%; border-radius:var(--r-pill); animation: ov-bar .7s cubic-bezier(.22,.61,.36,1) both; }
`;

/* Compteur animé (ignore les valeurs non numériques). */
function useCountUp(value, ms = 750) {
  const numeric = typeof value === "number" && isFinite(value);
  const [n, setN] = useState(numeric ? 0 : value);
  const ref = useRef();
  useEffect(() => {
    if (!numeric) { setN(value); return; }
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased * 10) / 10);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value, numeric, ms]);
  return numeric ? (Number.isInteger(value) ? Math.round(n) : n) : n;
}

function fmt(v) {
  return typeof v === "number" ? v.toLocaleString("fr-FR") : (v ?? "—");
}

/* ─── Rendus de détail par type ─── */
function DetailTrend({ d }) {
  const data = (d.series || []).filter((p) => p.value !== null && p.value !== undefined);
  if (!data.length) return <Empty />;
  return (
    <div style={{ height: 230 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} width={40} unit={d.unit || ""} />
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12.5 }}
            formatter={(v) => [`${v}${d.unit || ""}`, ""]} />
          <Area type="monotone" dataKey="value" stroke="var(--gold-deep)" strokeWidth={2.6}
            fill="url(#ovGrad)" dot={{ r: 3, fill: "var(--gold-deep)" }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DetailDistribution({ d }) {
  const items = d.items || [];
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 2px" }}>
      {items.map((it, i) => {
        const tn = TONE[it.tone] || TONE.gold;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>{it.label}</span>
              <span style={{ color: tn.c, fontWeight: 700 }}>{fmt(it.value)}</span>
            </div>
            <div className="ov-distrow" style={{ height: 10, background: "var(--line-soft)", borderRadius: 999 }}>
              <i style={{ width: `${((it.value || 0) / max) * 100}%`, background: tn.c, animationDelay: `${i * 80}ms` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailGauge({ d }) {
  const v = Math.max(0, Math.min(d.max || 100, d.value || 0));
  const pct = (v / (d.max || 100)) * 100;
  const R = 64, C = 2 * Math.PI * R;
  const tone = pct >= 70 ? TONE.success : pct >= 40 ? TONE.warning : TONE.danger;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "10px 0 4px" }}>
      <svg width="170" height="170" viewBox="0 0 170 170">
        <circle cx="85" cy="85" r={R} fill="none" stroke="var(--line-soft)" strokeWidth="14" />
        <circle cx="85" cy="85" r={R} fill="none" stroke={tone.c} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} transform="rotate(-90 85 85)"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.22,.61,.36,1)" }} />
        <text x="85" y="80" textAnchor="middle" fontSize="34" fontWeight="700" fill="var(--ink)">{Math.round(pct)}%</text>
        <text x="85" y="104" textAnchor="middle" fontSize="12" fill="var(--muted)">{d.label || ""}</text>
      </svg>
    </div>
  );
}

function DetailList({ d }) {
  const items = d.items || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", maxHeight: 340, overflow: "auto" }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "11px 4px",
          borderTop: i ? "1px solid var(--line-soft)" : "none",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-deep)",
            display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>{(it.primary || "?").slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.primary}</div>
            {it.secondary && <div style={{ fontSize: 12, color: "var(--muted)" }}>{it.secondary}</div>}
          </div>
          {it.badge && <span style={{ fontSize: 11.5, color: "var(--danger)", background: "var(--danger-bg)", padding: "3px 9px", borderRadius: 999, fontWeight: 600 }}>{it.badge}</span>}
        </div>
      ))}
    </div>
  );
}

function DetailStat({ d }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, padding: "4px 0" }}>
      {(d.items || []).map((it, i) => (
        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: var_r("md"), padding: "14px 16px", background: "var(--bg-alt)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{it.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{fmt(it.value)}</div>
        </div>
      ))}
    </div>
  );
}
const var_r = (k) => `var(--r-${k})`;
const Empty = () => <div style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>Aucune donnée disponible.</div>;

function DetailRadar({ d }) {
  const data = d.series || [];
  if (!data.length) return <Empty />;
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "var(--faint)" }} angle={90} />
          <Radar name="Attendu" dataKey="attendu" stroke="var(--muted)" fill="var(--muted)" fillOpacity={0.12} />
          <Radar name="Actuel" dataKey="actuel" stroke="var(--gold-deep)" fill="var(--gold)" fillOpacity={0.35} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12.5 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DetailMultiTrend({ d }) {
  const data = d.series || [];
  const lines = d.lines || [];
  if (!data.length) return <Empty />;
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--line-soft)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} width={38} />
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12.5 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color}
              strokeWidth={2.6} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DetailScatter({ d }) {
  const pts = d.points || [];
  if (!pts.length) return <Empty />;
  return (
    <div style={{ height: 270 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, left: 4, bottom: 14 }}>
          <CartesianGrid stroke="var(--line-soft)" />
          <XAxis type="number" dataKey={d.xKey} name={d.xLabel} stroke="var(--muted)" fontSize={11.5}
            domain={[0, 5]} tickCount={6}
            label={{ value: d.xLabel, position: "insideBottom", offset: -6, fontSize: 11, fill: "var(--muted)" }} />
          <YAxis type="number" dataKey={d.yKey} name={d.yLabel} stroke="var(--muted)" fontSize={11.5} width={56} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) =>
            active && payload && payload.length ? (
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 11px", fontSize: 12 }}>
                <b style={{ color: "var(--ink)" }}>{payload[0].payload[d.nameKey]}</b><br />
                <span style={{ color: "var(--muted)" }}>{d.xLabel} : {payload[0].payload[d.xKey]}</span><br />
                <span style={{ color: "var(--muted)" }}>{d.yLabel} : {Number(payload[0].payload[d.yKey]).toLocaleString("fr-FR")}</span>
              </div>) : null} />
          <Scatter data={pts} fill="var(--gold)" fillOpacity={0.8} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function Detail({ detail }) {
  if (!detail) return <Empty />;
  const map = { trend: DetailTrend, distribution: DetailDistribution, gauge: DetailGauge, list: DetailList, stat: DetailStat, radar: DetailRadar, multitrend: DetailMultiTrend, scatter: DetailScatter };
  const C = map[detail.kind] || Empty;
  return (
    <div>
      <C d={detail} />
      {detail.note && <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{detail.note}</div>}
    </div>
  );
}

/* ─── Carte KPI ─── */
function KpiCard({ card, index, onOpen }) {
  const tn = TONE[card.tone] || TONE.gold;
  const display = useCountUp(card.value);
  return (
    <div className="ov-card" style={{ "--tone-c": tn.c, animationDelay: `${index * 70}ms` }}
      onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>{card.label}</span>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: tn.c, boxShadow: `0 0 0 4px ${tn.bg}` }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 14 }}>
        <span style={{ fontSize: 34, fontWeight: 700, color: "var(--ink)", lineHeight: 1, letterSpacing: -0.5 }}>{fmt(display)}</span>
        {card.unit && <span style={{ fontSize: 16, fontWeight: 600, color: "var(--muted)" }}>{card.unit}</span>}
      </div>
      <div className="ov-cta" style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 14, fontSize: 12, color: "var(--gold-deep)", fontWeight: 600 }}>
        Voir le détail <ChevronRight size={14} />
      </div>
    </div>
  );
}

/* ─── Overlay focus ─── */
function FocusOverlay({ block, card, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  const tn = TONE[card.tone] || TONE.gold;
  const Icon = ICONS[block.icon] || Activity;
  return createPortal(
    <div className="ov-backdrop" onClick={onClose}>
      <div className="ov-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 22px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ width: 44, height: 44, borderRadius: var_r("md"), background: tn.bg, color: tn.c, display: "grid", placeItems: "center" }}>
            <Icon size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{block.title}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{card.label}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: tn.c }}>{fmt(card.value)}{card.unit}</span>
            </div>
          </div>
          <button onClick={onClose} className="sd-btn sd-btn--ghost sd-btn--sm" aria-label="Fermer"
            style={{ padding: 8, borderRadius: 999 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <Detail detail={card.detail} />
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Bloc ─── */
function Block({ block, index, focused, setFocused }) {
  const Icon = ICONS[block.icon] || Activity;
  const cols = Math.min(4, Math.max(1, (block.cards || []).length));
  return (
    <section className="ov-block" style={{ marginTop: index ? 30 : (block.hideHeader ? 0 : 22), animationDelay: `${index * 90}ms` }}>
      {!block.hideHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: var_r("md"), background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center" }}>
            <Icon size={19} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{block.title}</h2>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,var(--line),transparent)" }} />
        </div>
      )}
      <div className="ov-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 16 }}>
        {block.cards.map((card, i) => (
          <KpiCard key={card.key} card={card} index={i}
            onOpen={() => setFocused((f) => (f && f.b === block.id && f.k === card.key ? null : { b: block.id, k: card.key }))} />
        ))}
      </div>
    </section>
  );
}

export default function OverviewBlocks({ blocks }) {
  const [focused, setFocused] = useState(null);
  const active = focused && blocks.find((b) => b.id === focused.b);
  const activeCard = active && active.cards.find((c) => c.key === focused.k);
  return (
    <div style={{ filter: focused ? "saturate(.6)" : "none", transition: "filter .25s" }}>
      <style>{CSS + `
        @media (max-width:1100px){ .ov-grid{ grid-template-columns:repeat(2,1fr)!important; } }
        @media (max-width:560px){ .ov-grid{ grid-template-columns:1fr!important; } }
      `}</style>
      {blocks.map((block, i) => (
        <Block key={block.id} block={block} index={i} focused={focused} setFocused={setFocused} />
      ))}
      {active && activeCard && (
        <FocusOverlay block={active} card={activeCard} onClose={() => setFocused(null)} />
      )}
    </div>
  );
}
