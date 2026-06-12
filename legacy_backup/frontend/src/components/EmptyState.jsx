import { Inbox } from "lucide-react";
export default function EmptyState({ title, hint }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "48px 20px", color: "var(--muted)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: "var(--gold-tint)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--gold-deep)", marginBottom: 14,
      }}>
        <Inbox size={24} />
      </div>
      <div style={{ fontWeight: 600, color: "var(--ink)" }}>{title}</div>
      {hint && <div style={{ fontSize: 13, marginTop: 6, maxWidth: 360 }}>{hint}</div>}
    </div>
  );
}
