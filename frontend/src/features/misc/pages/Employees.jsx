import { useState } from "react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getEmployees } from "../../../lib/api";
import { STATUS_LABELS } from "../../../lib/constants";

const tone = { ACTIVE: "success", NEW: "info", LEAVING: "warning" };
const PAGE_SIZE = 100;

export default function Employees() {
  const { t, lang } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");   // recherche appliquée (après Entrée)

  // GET /api/v1/employees?page=&page_size=&search= -> { data:[...], meta:{total,page,page_size} }
  const { data, loading, error, reload } = useAsync(
    () => getEmployees({ page, page_size: PAGE_SIZE, ...(query ? { search: query } : {}) }),
    [page, query]
  );
  const employees = (data && data.data) || [];
  const total = (data && data.meta && data.meta.total) || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applySearch = (e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); };

  const field = { height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none" };
  const navBtn = (disabled) => ({ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: disabled ? 0.5 : 1 });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 18px", flexWrap: "wrap" }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("emp.title")}</h1>
        {total > 0 && <Badge tone="gold">{total}</Badge>}
        <form onSubmit={applySearch} style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("emp.search")} style={{ ...field, width: 240 }} />
          <button type="submit" style={navBtn(false)}>{t("emp.searchBtn")}</button>
        </form>
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!employees.length} emptyLabel={t("emp.empty")}>
        <Card style={{ padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>{t("emp.name")}</span><span>{t("emp.dept")}</span><span>{t("emp.role")}</span><span>{t("emp.status")}</span>
          </div>
          {employees.map((e, i) => {
            const name = `${e.prenom || ""} ${e.nom || ""}`.trim() || e.email || "—";
            const status = e.status || "ACTIVE";
            return (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr auto", gap: 12, alignItems: "center", padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{name.charAt(0)}</span>
                  {name}
                </span>
                <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{e.department || e.department_id || "—"}</span>
                <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{e.poste || "—"}</span>
                <Badge tone={tone[status]}>{STATUS_LABELS[status]?.[lang] || status}</Badge>
              </div>
            );
          })}
        </Card>

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} style={navBtn(page <= 1 || loading)}>{t("emp.prev")}</button>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{t("emp.page")} {page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages || loading} style={navBtn(page >= pages || loading)}>{t("emp.next")}</button>
        </div>
      </AsyncBoundary>
    </div>
  );
}
