import { useEffect, useRef, useState } from "react";
import { Search, X, GitCompareArrows } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import Card from "../../../components/Card";
import { visionSearch, getCompare } from "../../../lib/api";

const COLORS = ["#B0802F", "#3E6E8E", "#4F6B27", "#A8402C", "#8A5E16", "#6D5BD0", "#0E8A8A", "#B5562E"];

export default function CareerComparator() {
  const [metric, setMetric] = useState("salaire");
  const [selected, setSelected] = useState([]); // [{matricule, nom}]
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showRes, setShowRes] = useState(false);
  const [data, setData] = useState(null);
  const boxRef = useRef();

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const h = setTimeout(() => {
      visionSearch(query.trim()).then((r) => { setResults((r && r.data) || []); setShowRes(true); }, () => setResults([]));
    }, 300);
    return () => clearTimeout(h);
  }, [query]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setShowRes(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // (Re)charge la comparaison quand la sélection ou la métrique change.
  useEffect(() => {
    if (!selected.length) { setData(null); return; }
    let alive = true;
    getCompare(metric, selected.map((s) => s.matricule)).then(
      (r) => alive && setData((r && r.data) || null), () => alive && setData(null));
    return () => { alive = false; };
  }, [metric, selected]);

  const add = (emp) => {
    if (!selected.some((s) => s.matricule === emp.matricule) && selected.length < 8) {
      setSelected((p) => [...p, { matricule: emp.matricule, nom: emp.nom }]);
    }
    setQuery(""); setResults([]); setShowRes(false);
  };
  const remove = (mat) => setSelected((p) => p.filter((s) => s.matricule !== mat));

  // Construit les données du graphe : [{label, [nom]:valeur, ...}]
  const chart = [];
  if (data && data.series.length) {
    data.labels.forEach((lab, i) => {
      const row = { label: lab };
      data.series.forEach((s) => { row[s.nom] = s.values[i]; });
      chart.push(row);
    });
  }
  const unit = metric === "salaire" ? " €" : "";

  return (
    <Card style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 34, height: 34, borderRadius: "var(--r-md)", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center" }}>
          <GitCompareArrows size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Comparateur carrières</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Sélectionnez des collaborateurs — une courbe par personne.</div>
        </div>
        {/* Bascule métrique */}
        <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
          {[["salaire", "Salaire"], ["competences", "Compétences"]].map(([k, lab]) => (
            <button key={k} onClick={() => setMetric(k)}
              style={{ padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: metric === k ? "var(--gold-tint)" : "transparent", color: metric === k ? "var(--gold-deep)" : "var(--muted)" }}>
              {lab}
            </button>
          ))}
        </div>
      </div>

      {/* Recherche */}
      <div ref={boxRef} style={{ position: "relative", maxWidth: 420 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input className="sd-field" value={query} onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setShowRes(true)} placeholder="Ajouter un collaborateur…" style={{ paddingLeft: 36, width: "100%" }} />
        {showRes && query.trim() && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)", maxHeight: 260, overflow: "auto" }}>
            {results.length === 0 && <div style={{ padding: 12, fontSize: 13, color: "var(--muted)" }}>Aucun résultat.</div>}
            {results.map((r) => (
              <button key={r.matricule} onClick={() => add(r)} style={{ display: "flex", flexDirection: "column", width: "100%", textAlign: "left", padding: "9px 14px", border: "none", background: "transparent", cursor: "pointer", borderTop: "1px solid var(--line-soft)" }}>
                <span style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 500 }}>{r.nom}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.poste}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chips sélectionnés */}
      {selected.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {selected.map((s, i) => (
            <span key={s.matricule} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 8px 5px 11px", borderRadius: "var(--r-pill)", background: "var(--bg-alt)", border: "1px solid var(--line)", fontSize: 12.5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: COLORS[i % COLORS.length] }} />
              {s.nom}
              <span onClick={() => remove(s.matricule)} style={{ cursor: "pointer", display: "grid", placeItems: "center", color: "var(--muted)" }}><X size={13} /></span>
            </span>
          ))}
        </div>
      )}

      {/* Graphe */}
      <div style={{ height: 320, marginTop: 16 }}>
        {chart.length === 0 ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13, border: "1px dashed var(--line)", borderRadius: "var(--r-md)" }}>
            Recherchez et ajoutez des collaborateurs pour comparer leur {metric === "salaire" ? "salaire" : "niveau de compétences"}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--line-soft)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} width={56} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12.5 }} formatter={(v) => `${Number(v).toLocaleString("fr-FR")}${unit}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(data?.series || []).map((s, i) => (
                <Line key={s.matricule} type="monotone" dataKey={s.nom} stroke={COLORS[i % COLORS.length]} strokeWidth={2.4} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
