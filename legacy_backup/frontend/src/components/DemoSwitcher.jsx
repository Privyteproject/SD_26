import { useNavigate } from "react-router-dom";
import { useSession } from "../app/providers/SessionProvider";
import { useI18n } from "../app/providers/I18nProvider";
import { ROLES, ROLE_LABELS, STATUS, STATUS_LABELS } from "../lib/constants";
import { homeForRole } from "../lib/rbac";

const selectStyle = {
  height: 36, borderRadius: 8, border: "1px solid var(--line)",
  background: "var(--surface)", color: "var(--ink)", fontSize: 13,
  padding: "0 8px", cursor: "pointer", fontFamily: "inherit",
};

export default function DemoSwitcher() {
  const { role, status, setRole, setStatus } = useSession();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const onRole = (e) => {
    const r = e.target.value;
    setRole(r);
    navigate(homeForRole(r));
  };

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 10px", borderRadius: 10,
        border: "1px dashed var(--gold-soft)", background: "var(--gold-tint)",
      }}
      title={t("demo.title")}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gold-deep)", whiteSpace: "nowrap" }}>
        {t("demo.title")}
      </span>
      <select value={role} onChange={onRole} style={selectStyle} aria-label={t("demo.role")}>
        {Object.values(ROLES).map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r][lang]}</option>
        ))}
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle} aria-label={t("demo.status")}>
        {Object.values(STATUS).map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s][lang]}</option>
        ))}
      </select>
    </div>
  );
}
