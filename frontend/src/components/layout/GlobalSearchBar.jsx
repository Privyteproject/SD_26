import { useRef, useEffect } from "react";
import { Search, User, FileText, Calendar, Link as LinkIcon, Loader2 } from "lucide-react";
import { useI18n } from "../../app/providers/I18nProvider";
import { useGlobalSearch } from "../../hooks/useGlobalSearch";

const ICONS = { user: User, file: FileText, calendar: Calendar, link: LinkIcon };
const GROUP_LABEL = { employee: "search.employees", document: "search.documents", absence: "search.absences", page: "search.pages" };
const GROUP_ORDER = ["employee", "document", "absence", "page"];

export default function GlobalSearchBar() {
  const { t } = useI18n();
  const { query, results, isLoading, isOpen, selectedIndex, setQuery, selectResult, closeDropdown, handleKeyDown, open } = useGlobalSearch();
  const boxRef = useRef(null);

  // Clic en dehors → ferme le dropdown.
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) closeDropdown(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [closeDropdown]);

  const term = query.trim();
  // Regroupe les résultats par type en conservant l'index global (pour le surlignage clavier).
  const groups = GROUP_ORDER
    .map((type) => ({ type, items: results.map((r, idx) => ({ r, idx })).filter((x) => x.r.type === type) }))
    .filter((g) => g.items.length);

  return (
    <div ref={boxRef} style={{ position: "relative", flex: 1, maxWidth: 480 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--muted)" }}>
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={open}
          onKeyDown={handleKeyDown}
          placeholder={t("header.search")}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="global-search-listbox"
          aria-activedescendant={selectedIndex >= 0 ? `search-opt-${selectedIndex}` : undefined}
          aria-autocomplete="list"
          style={{ border: "none", outline: "none", background: "transparent", color: "var(--ink)", width: "100%", fontSize: 13.5, fontFamily: "inherit" }}
        />
        {isLoading && <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite", color: "var(--gold-deep)" }} />}
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>

      {isOpen && term.length >= 1 && (
        <div id="global-search-listbox" role="listbox" style={{ position: "absolute", top: 44, left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow)", zIndex: 40, maxHeight: 440, overflowY: "auto", padding: 6 }}>
          {term.length < 2 ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>{t("search.min2")}</div>
          ) : isLoading && !results.length ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>{t("search.searching")}</div>
          ) : !results.length ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>{t("search.noneFor")} « {term} »</div>
          ) : (
            groups.map((g) => {
              const Icon = ICONS[results[g.items[0].idx].icon] || LinkIcon;
              return (
                <div key={g.type} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "var(--muted)", fontWeight: 600, padding: "8px 10px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon size={12} /> {t(GROUP_LABEL[g.type] || g.type)} ({g.items.length})
                  </div>
                  {g.items.map(({ r, idx }) => {
                    const ItemIcon = ICONS[r.icon] || LinkIcon;
                    const active = idx === selectedIndex;
                    return (
                      <button
                        key={`${r.type}-${r.id}-${idx}`}
                        id={`search-opt-${idx}`}
                        role="option"
                        aria-selected={active}
                        onClick={() => selectResult(r)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, border: "none", background: active ? "var(--gold-tint)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                      >
                        <ItemIcon size={15} style={{ color: "var(--gold-deep)", flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                          {r.subtitle && <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subtitle}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
