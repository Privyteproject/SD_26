import { useState, useEffect } from "react";
import { Check, Plus, Trash2, Pencil, Sparkles, FileText } from "lucide-react";
import { useI18n } from "../app/providers/I18nProvider";
import Card from "./Card";
import Badge from "./Badge";
import AsyncBoundary from "./AsyncBoundary";
import { useAsync } from "../lib/useAsync";
import {
  getEmployees, getParcours, initParcours, updateTacheStatus, generateParcours,
  addParcoursTache, deleteParcoursTache, generateTransferSummary,
  getParcoursModeles, createModele, updateModele, deleteModele,
} from "../lib/api";

const today = () => new Date().toISOString().slice(0, 10);
const inputStyle = { height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none" };
const smallBtn = (color) => ({ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });
const goldBtn = { height: 38, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 };
const fail = (t, e) => window.alert((e && (e.payload?.detail || e.message)) || t("common.error"));

// ── Panneau de droite : tâches d'un employé (cocher, ajouter une tâche perso, supprimer) ──
function TaskPanel({ matricule, type }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(() => getParcours(matricule, { type }), [matricule, type]);
  const tasks = ((data && data.data) || []).slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const [busy, setBusy] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [summary, setSummary] = useState("");

  const genSummary = async () => {
    setBusy(true); setSummary("");
    try { const r = await generateTransferSummary(matricule); setSummary((r && r.data && r.data.summary) || ""); }
    catch (e) { fail(t, e); } finally { setBusy(false); }
  };

  const done = tasks.filter((x) => x.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const toggle = async (tk) => {
    const next = tk.status === "done" ? "todo" : "done";
    setBusy(true);
    try { await updateTacheStatus(tk.id, next, next === "done" ? today() : undefined); reload(); }
    catch (e) { fail(t, e); } finally { setBusy(false); }
  };
  const init = async () => {
    setBusy(true);
    try { await initParcours(matricule, type); reload(); }
    catch (e) { fail(t, e); } finally { setBusy(false); }
  };
  const genAi = async () => {
    setBusy(true);
    try { await generateParcours(matricule, type); reload(); }
    catch (e) { fail(t, e); } finally { setBusy(false); }
  };
  const addTask = async () => {
    if (!newTask.trim()) return;
    setBusy(true);
    try { await addParcoursTache(matricule, { libelle: newTask.trim(), type_parcours: type }); setNewTask(""); reload(); }
    catch (e) { fail(t, e); } finally { setBusy(false); }
  };
  const removeTask = async (id) => {
    if (!window.confirm(t("parc.confirmDel"))) return;
    setBusy(true);
    try { await deleteParcoursTache(id); reload(); }
    catch (e) { fail(t, e); } finally { setBusy(false); }
  };

  return (
    <AsyncBoundary loading={loading} error={error} onRetry={reload}>
      <Card style={{ opacity: busy ? 0.7 : 1 }}>
        {tasks.length > 0 ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>{t("parc.tasks")}</div>
              <div style={{ flex: 1, height: 8, background: "var(--gold-tint)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "var(--gold)" }} />
              </div>
              <Badge tone="gold">{progress}%</Badge>
              <button onClick={genAi} disabled={busy} title={t("parc.genAi")} style={smallBtn("var(--gold-deep)")}><Sparkles size={15} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {tasks.map((tk) => {
                const isDone = tk.status === "done";
                return (
                  <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => toggle(tk)} disabled={busy} style={{ flex: 1, display: "flex", alignItems: "center", gap: 11, fontSize: 14, color: isDone ? "var(--muted)" : "var(--ink)", background: "transparent", border: "none", textAlign: "left", cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", padding: 0 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1px solid ${isDone ? "var(--gold)" : "var(--line)"}`, background: isDone ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isDone && <Check size={13} color="var(--on-gold)" strokeWidth={3} />}
                      </span>
                      <span style={{ textDecoration: isDone ? "line-through" : "none" }}>{tk.libelle || tk.code_tache}</span>
                    </button>
                    <button onClick={() => removeTask(tk.id)} disabled={busy} title={t("parc.del")} style={smallBtn("var(--danger)")}><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
            <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 12 }}>{t("parc.noParcours")}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={init} disabled={busy} style={{ ...goldBtn, background: "transparent", color: "var(--gold-deep)", border: "1px solid var(--line)" }}>{t("parc.init")}</button>
              <button onClick={genAi} disabled={busy} style={goldBtn}><Sparkles size={16} /> {busy ? t("common.loading") : t("parc.genAi")}</button>
            </div>
          </div>
        )}

        {/* Ajout d'une tâche personnalisée — toujours disponible */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
            placeholder={t("parc.taskName")}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addTask} disabled={busy || !newTask.trim()} style={{ ...goldBtn, opacity: busy || !newTask.trim() ? 0.6 : 1 }}>
            <Plus size={16} /> {t("parc.add")}
          </button>
        </div>

        {/* Synthèse de transfert — offboarding uniquement */}
        {type === "OFFBOARDING" && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <button onClick={genSummary} disabled={busy} style={{ ...goldBtn, background: "transparent", color: "var(--gold-deep)", border: "1px solid var(--line)", opacity: busy ? 0.6 : 1 }}>
              <FileText size={16} /> {t("parc.transferSummary")}
            </button>
            {summary && (
              <div style={{ marginTop: 12, background: "var(--field)", border: "1px solid var(--line)", borderRadius: 10, padding: 14, fontSize: 13.5, color: "var(--ink)", whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}>
                {summary}
              </div>
            )}
          </div>
        )}
      </Card>
    </AsyncBoundary>
  );
}

// ── Gestion des modèles par défaut (gabarits appliqués aux nouveaux parcours) ──
function ModeleManager({ type }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(() => getParcoursModeles({ type }), [type]);
  const modeles = (data && data.data) || [];
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState("");
  const [delay, setDelay] = useState("");

  const add = async () => {
    if (!lib.trim()) return;
    setBusy(true);
    try { await createModele({ libelle: lib.trim(), type_parcours: type, delai_jours: delay ? Number(delay) : null }); setLib(""); setDelay(""); reload(); }
    catch (e) { fail(t, e); } finally { setBusy(false); }
  };
  const edit = async (m) => {
    const v = window.prompt(t("parc.editPrompt"), m.libelle);
    if (v == null || !v.trim()) return;
    setBusy(true);
    try { await updateModele(m.code, { libelle: v.trim() }); reload(); }
    catch (e) { fail(t, e); } finally { setBusy(false); }
  };
  const remove = async (m) => {
    if (!window.confirm(t("parc.confirmDel"))) return;
    setBusy(true);
    try { await deleteModele(m.code); reload(); }
    catch (e) { e?.status === 409 ? window.alert(t("parc.modelInUse")) : fail(t, e); }
    finally { setBusy(false); }
  };

  return (
    <Card style={{ marginTop: 24, opacity: busy ? 0.7 : 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("parc.models")}</div>
      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {modeles.map((m) => (
            <div key={m.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{m.libelle}</span>
              {m.delai_jours != null && <span style={{ fontSize: 12, color: "var(--muted)" }}>{m.delai_jours} j</span>}
              <button onClick={() => edit(m)} disabled={busy} title={t("parc.edit")} style={smallBtn("var(--gold-deep)")}><Pencil size={14} /></button>
              <button onClick={() => remove(m)} disabled={busy} title={t("parc.del")} style={smallBtn("var(--danger)")}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input value={lib} onChange={(e) => setLib(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={t("parc.taskName")} style={{ ...inputStyle, flex: 1 }} />
          <input value={delay} onChange={(e) => setDelay(e.target.value.replace(/\D/g, ""))} placeholder={t("parc.delay")} style={{ ...inputStyle, width: 110 }} />
          <button onClick={add} disabled={busy || !lib.trim()} style={{ ...goldBtn, opacity: busy || !lib.trim() ? 0.6 : 1 }}><Plus size={16} /> {t("parc.add")}</button>
        </div>
      </AsyncBoundary>
    </Card>
  );
}

// ── Vue RH maître-détail : employés (par statut) + tâches éditables + modèles ──
export default function ParcoursManager({ type, statusFilter, title, emptyLabel }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(() => getEmployees({ status: statusFilter }), [statusFilter]);
  const employees = (data && data.data) || [];
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (employees.length && !employees.some((e) => e.id === selected)) setSelected(employees[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{title}</h1>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!employees.length} emptyLabel={emptyLabel}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
          <Card style={{ padding: 0, alignSelf: "flex-start" }}>
            {employees.map((e, i) => {
              const name = `${e.prenom || ""} ${e.nom || ""}`.trim() || e.email;
              const active = e.id === selected;
              return (
                <button key={e.id} onClick={() => setSelected(e.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", borderTop: i ? "1px solid var(--line)" : "none", background: active ? "var(--gold-tint)" : "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14, flexShrink: 0 }}>{name.charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{e.department || e.poste || "—"}</div>
                  </div>
                </button>
              );
            })}
          </Card>

          <div>
            {selected ? <TaskPanel matricule={selected} type={type} /> : (
              <Card style={{ textAlign: "center", padding: 28, color: "var(--muted)" }}>{t("parc.select")}</Card>
            )}
          </div>
        </div>
      </AsyncBoundary>

      {/* Gestion des modèles par défaut — toujours visible */}
      <ModeleManager type={type} />
    </div>
  );
}
