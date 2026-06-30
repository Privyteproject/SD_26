import { useState } from "react";
import { Megaphone, Send, Search, Pin, Users, Eye } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getEmployees, createAnnonce, getAnnoncesAuthored } from "../../../lib/api";

async function fetchAllEmployees() {
  const first = await getEmployees({ page: 1, page_size: 100 });
  const total = (first.meta && first.meta.total) || (first.data || []).length;
  const pages = Math.ceil(total / 100);
  let rows = first.data || [];
  if (pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, k) => getEmployees({ page: k + 2, page_size: 100 })));
    rows = rows.concat(...rest.map((r) => r.data || []));
  }
  return rows;
}

function when(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "short" });
}

export default function NewsRh() {
  const { t, lang } = useI18n();
  const { data, loading, error } = useAsync(async () => ({ employees: await fetchAllEmployees() }));
  const employees = data?.employees || [];
  const sent = useAsync(async () => (await getAnnoncesAuthored()).data || []);

  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [epingle, setEpingle] = useState(false);
  const [toAll, setToAll] = useState(true);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const empName = (e) => `${e.prenom || ""} ${e.nom || ""}`.trim() || e.id;
  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    return !q || empName(e).toLowerCase().includes(q) || (e.poste || "").toLowerCase().includes(q);
  });
  const allSel = filtered.length > 0 && filtered.every((e) => sel.has(e.id));
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => { const n = new Set(s); if (allSel) filtered.forEach((e) => n.delete(e.id)); else filtered.forEach((e) => n.add(e.id)); return n; });

  const canSend = titre.trim() && contenu.trim() && (toAll || sel.size > 0);
  const publish = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      const body = toAll ? { titre: titre.trim(), contenu: contenu.trim(), epingle, audience: "all" }
                         : { titre: titre.trim(), contenu: contenu.trim(), epingle, employee_ids: [...sel] };
      const r = await createAnnonce(body);
      window.alert(`${(r?.data?.destinataires) || 0} ${t("news.sentTo")}`);
      setTitre(""); setContenu(""); setEpingle(false); setSel(new Set());
      sent.reload();
    } catch (e) { window.alert((e && (e.payload?.detail || e.message)) || "Erreur"); } finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("news.rhTitle")}</h1>

      <AsyncBoundary loading={loading} error={error}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, opacity: busy ? 0.8 : 1 }}>
          {/* Rédaction */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
              <Megaphone size={17} color="var(--gold-deep)" /> {t("news.compose")}
            </div>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={t("news.titlePh")} className="sd-field" style={{ marginBottom: 10 }} />
            <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} placeholder={t("news.bodyPh")} className="sd-field" style={{ minHeight: 120, marginBottom: 10 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ink)", marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={epingle} onChange={(e) => setEpingle(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--gold)" }} />
              <Pin size={14} color="var(--gold-deep)" /> {t("news.pinIt")}
            </label>

            {/* Destinataires */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => setToAll(true)} style={{ flex: 1, height: 36, borderRadius: 8, border: `1px solid ${toAll ? "var(--gold)" : "var(--line)"}`, background: toAll ? "var(--gold-tint)" : "transparent", color: "var(--ink)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Users size={14} /> {t("news.allCompany")}</button>
                <button onClick={() => setToAll(false)} style={{ flex: 1, height: 36, borderRadius: 8, border: `1px solid ${!toAll ? "var(--gold)" : "var(--line)"}`, background: !toAll ? "var(--gold-tint)" : "transparent", color: "var(--ink)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{t("news.selection")}</button>
              </div>

              {!toAll && (
                <>
                  <div style={{ position: "relative", marginBottom: 8 }}>
                    <Search size={15} color="var(--muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("news.searchEmp")} className="sd-field" style={{ paddingLeft: 32 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <button onClick={toggleAll} style={{ background: "none", border: "none", color: "var(--gold-deep)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>{allSel ? t("news.unselectAll") : t("news.selectAll")} ({filtered.length})</button>
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{sel.size} {t("news.selected")}</span>
                  </div>
                  <div style={{ border: "1px solid var(--line)", borderRadius: 10, maxHeight: 220, overflowY: "auto" }}>
                    {filtered.map((e, i) => (
                      <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i ? "1px solid var(--line)" : "none", cursor: "pointer" }}>
                        <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} style={{ width: 16, height: 16, accentColor: "var(--gold)" }} />
                        <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{empName(e)}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{e.poste || "—"}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <button onClick={publish} disabled={busy || !canSend} className="sd-btn sd-btn--gold" style={{ marginTop: 12 }}>
                <Send size={15} /> {t("news.publish")}{toAll ? "" : ` (${sel.size})`}
              </button>
            </div>
          </Card>

          {/* Annonces publiées */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("news.published")}</div>
            <AsyncBoundary loading={sent.loading} error={sent.error} onRetry={sent.reload} empty={!(sent.data || []).length} emptyLabel={t("news.noneSent")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {(sent.data || []).map((a) => (
                  <div key={a.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {a.epingle && <Pin size={13} color="var(--gold-deep)" />}
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{a.titre}</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{when(a.date_creation, lang)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                      <Badge tone="info"><Users size={11} /> {a.nb_destinataires}</Badge>
                      <Badge tone="success"><Eye size={11} /> {a.nb_lus}/{a.nb_destinataires} {t("news.read")}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </AsyncBoundary>
          </Card>
        </div>
      </AsyncBoundary>
    </div>
  );
}
