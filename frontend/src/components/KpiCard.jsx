export default function KpiCard({ label, value, sub }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: 16, padding: 20,
    }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</div>
      <div className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--gold-deep)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
