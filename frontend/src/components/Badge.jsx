// Badge basé sur le kit officiel (.sd-badge--{tone}).
const TONES = { gold: "gold", danger: "danger", success: "success", warning: "warning", info: "info" };

export default function Badge({ children, tone = "gold" }) {
  const t = TONES[tone] || "gold";
  return <span className={`sd-badge sd-badge--${t}`}>{children}</span>;
}
