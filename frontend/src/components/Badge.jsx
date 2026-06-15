const tones = {
  gold: { bg: "var(--gold-tint)", fg: "var(--gold-deep)" },
  danger: { bg: "rgba(180,64,46,.14)", fg: "var(--danger)" },
  success: { bg: "rgba(92,122,46,.16)", fg: "var(--success)" },
  warning: { bg: "rgba(183,121,31,.16)", fg: "var(--warning)" },
  info: { bg: "rgba(62,110,142,.16)", fg: "var(--info)" },
};
export default function Badge({ children, tone = "gold" }) {
  const c = tones[tone] || tones.gold;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
      background: c.bg, color: c.fg,
    }}>
      {children}
    </span>
  );
}
