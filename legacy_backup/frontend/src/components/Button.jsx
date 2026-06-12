export default function Button({ children, variant = "gold", style = {}, ...rest }) {
  const base = {
    height: 44, padding: "0 22px", borderRadius: 9, fontSize: 14.5,
    fontWeight: 600, cursor: "pointer", border: "none",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontFamily: "inherit",
  };
  const variants = {
    gold: { background: "var(--gold)", color: "var(--on-gold)" },
    line: { background: "transparent", color: "var(--ink)", border: "1px solid var(--gold)" },
    ghost: { background: "transparent", color: "var(--ink)", border: "1px solid var(--line)" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}
