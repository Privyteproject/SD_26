import { useEffect, useRef, useState } from "react";
import { Search, X, ScanFace, UserSearch } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { visionSearch } from "../../../lib/api";
import EmployeeHeader from "../components/EmployeeHeader";
import EmployeeTabs from "../components/EmployeeTabs";

const SKEY = "sd-vision-tabs";
const MAX_TABS = 6;

function loadTabs() {
  try { return JSON.parse(sessionStorage.getItem(SKEY)) || { open: [], active: null }; }
  catch { return { open: [], active: null }; }
}

export default function Vision360() {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => loadTabs().open);
  const [active, setActive] = useState(() => loadTabs().active);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showRes, setShowRes] = useState(false);
  const boxRef = useRef();

  // Persistance des onglets ouverts (survit au refresh).
  useEffect(() => {
    sessionStorage.setItem(SKEY, JSON.stringify({ open, active }));
  }, [open, active]);

  // Recherche debouncée.
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    const h = setTimeout(() => {
      visionSearch(query.trim()).then(
        (r) => { setResults((r && r.data) || []); setSearching(false); setShowRes(true); },
        () => { setResults([]); setSearching(false); }
      );
    }, 300);
    return () => clearTimeout(h);
  }, [query]);

  // Fermer le menu de résultats au clic extérieur.
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setShowRes(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const openEmployee = (emp) => {
    setOpen((prev) => {
      if (prev.some((p) => p.matricule === emp.matricule)) return prev;
      const next = [...prev, { matricule: emp.matricule, nom: emp.nom }];
      return next.slice(-MAX_TABS);
    });
    setActive(emp.matricule);
    setQuery(""); setResults([]); setShowRes(false);
  };

  const closeTab = (mat, e) => {
    e.stopPropagation();
    setOpen((prev) => {
      const next = prev.filter((p) => p.matricule !== mat);
      setActive((a) => (a === mat ? (next.length ? next[next.length - 1].matricule : null) : a));
      return next;
    });
  };

  return (
    <div>
      {/* En-tête + recherche */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center" }}>
          <ScanFace size={22} />
        </div>
        <div>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("nav.vision360")}</h1>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("vision.subtitle")}</div>
        </div>

        <div ref={boxRef} style={{ position: "relative", marginLeft: "auto", width: "min(420px, 100%)" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              className="sd-field" value={query} onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length && setShowRes(true)}
              placeholder={t("vision.search")} style={{ paddingLeft: 36, width: "100%" }}
            />
          </div>
          {showRes && (query.trim() !== "") && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30,
              background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-lg)", maxHeight: 320, overflow: "auto",
            }}>
              {searching && <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>}
              {!searching && results.length === 0 && <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>{t("vision.noResult")}</div>}
              {results.map((r) => (
                <button key={r.matricule} onClick={() => openEmployee(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                    padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer",
                    borderTop: "1px solid var(--line-soft)",
                  }}>
                  <span style={{ width: 28, height: 28, borderRadius: 999, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>
                    {(r.nom || "?").slice(0, 1)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 500 }}>{r.nom}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.poste}</div>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barre d'onglets collaborateurs */}
      {open.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {open.map((p) => {
            const on = p.matricule === active;
            return (
              <div key={p.matricule} onClick={() => setActive(p.matricule)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 10px 7px 14px",
                  borderRadius: "var(--r-pill)", cursor: "pointer", fontSize: 13,
                  border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                  background: on ? "var(--gold-tint)" : "var(--surface)",
                  color: on ? "var(--gold-deep)" : "var(--muted)", fontWeight: on ? 600 : 500,
                  boxShadow: on ? "var(--shadow-sm)" : "none",
                }}>
                {p.nom}
                <span onClick={(e) => closeTab(p.matricule, e)}
                  style={{ display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: 999, color: "var(--muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--line)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <X size={13} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Fiche du collaborateur actif */}
      {active ? (
        <div key={active}>
          <EmployeeHeader matricule={active} />
          <EmployeeTabs matricule={active} />
        </div>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 14, padding: "80px 20px", textAlign: "center", color: "var(--muted)",
          border: "1px dashed var(--line)", borderRadius: "var(--r-xl)", background: "var(--surface)",
        }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center" }}>
            <UserSearch size={30} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{t("vision.emptyTitle")}</div>
          <div style={{ fontSize: 13.5, maxWidth: 420 }}>{t("vision.emptyHint")}</div>
        </div>
      )}
    </div>
  );
}
