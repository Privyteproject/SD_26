// Marque Synapse Digital — empreinte digitale stylisée (rendue en SVG, aux couleurs du thème).
// layout: "mark" (icône seule) | "row" (icône + texte à droite) | "stack" (icône au-dessus du texte)
export default function Logo({ size = 32, layout = "mark", animated = false }) {
  const gid = "sd-gold-grad";
  const mark = (
    <svg width={size} height={size * 1.28} viewBox="0 0 80 104" fill="none" aria-hidden="true"
      className={animated ? "ds-logo-draw" : undefined} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gold-soft)" />
          <stop offset="0.55" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--gold-deep)" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gid})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Crêtes concentriques de l'empreinte (extérieure → cœur) */}
        <path d="M10 96 L10 46 A30 30 0 0 1 70 46 L70 96" />
        <path d="M15.5 92 L15.5 49 A24.5 24.5 0 0 1 64.5 49 L64.5 92" />
        <path d="M21 88 L21 52 A19 19 0 0 1 59 52 L59 88" />
        <path d="M26.5 84 L26.5 55 A13.5 13.5 0 0 1 53.5 55 L53.5 84" />
        <path d="M32 80 L32 58 A8 8 0 0 1 48 58 L48 80" />
        {/* Cœur */}
        <path d="M40 62 L40 74" />
        {/* Chevrons de la base */}
        <path d="M34 90 L40 86 L46 90" />
        <path d="M35 96 L40 92 L45 96" />
      </g>
    </svg>
  );

  if (layout === "mark") return mark;

  const wordmark = (
    <div style={{ textAlign: layout === "stack" ? "center" : "left", lineHeight: 1 }}>
      <div className="font-display" style={{
        fontSize: layout === "stack" ? size * 0.46 : size * 0.58, fontWeight: 600,
        letterSpacing: layout === "stack" ? "0.24em" : "0.04em",
        color: "var(--gold-deep)",
        marginLeft: layout === "stack" ? "0.24em" : 0,
      }}>SYNAPSE</div>
      <div style={{
        fontSize: layout === "stack" ? size * 0.2 : size * 0.26, fontWeight: 600,
        letterSpacing: layout === "stack" ? "0.46em" : "0.28em",
        color: "var(--gold)", marginTop: layout === "stack" ? 6 : 2,
        marginLeft: layout === "stack" ? "0.46em" : 0,
      }}>DIGITAL</div>
    </div>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: layout === "stack" ? "column" : "row",
      gap: layout === "stack" ? 14 : 12,
    }}>
      {mark}
      {wordmark}
    </div>
  );
}
