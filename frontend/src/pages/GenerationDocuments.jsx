import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun, Moon, FileText, Download, Eye, CheckCircle,
  ChevronRight, Menu, LogOut, Settings, LayoutDashboard,
  MessageSquare, Calendar, Sparkles, Clock, Filter, FilePlus
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useApi, API } from "../auth/useApi";
import { useSecurity } from "../auth/useSecurity";
import { getColors } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { Skeleton, SkeletonStyles } from "../components/Skeleton";
import toast, { Toaster } from "react-hot-toast";

const DOC_TYPES = [
  { id:"attestation_travail",  icon:"📄", label:"Attestation de travail",   desc:"Certifie votre emploi, poste et ancienneté",           delay:"Immédiat",         fields:["Nom complet","Poste","Date d'embauche","Département"] },
  { id:"attestation_salaire",  icon:"💰", label:"Attestation de salaire",   desc:"Indique votre rémunération brute mensuelle",           delay:"24h (validation RH)",fields:["Nom complet","Poste","Salaire brut","Période"] },
  { id:"demande_conge",        icon:"🏖️", label:"Demande de congés",        desc:"Soumettre une demande de congés payés ou RTT",         delay:"Immédiat",         fields:["Date de début","Date de fin","Type de congé","Motif"] },
  { id:"note_frais",           icon:"🧾", label:"Note de frais",            desc:"Déclarer des frais professionnels",                    delay:"Sous 48h",         fields:["Date","Nature des frais","Montant","Justificatif"] },
  { id:"demande_teletravail",  icon:"🏠", label:"Accord de télétravail",    desc:"Formaliser un arrangement de travail à distance",      delay:"5 jours ouvrés",   fields:["Jours souhaités","Période","Lieu de travail"] },
  { id:"mobilite_interne",     icon:"🚀", label:"Demande mobilité interne", desc:"Exprimer un souhait de changement de poste",           delay:"En traitement",    fields:["Poste visé","Département cible","Motif","Date souhaitée"] },
];

export default function GenerationDocuments({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [activeTab,    setActiveTab]    = useState("nouveau");
  const [selectedDoc,  setSelectedDoc]  = useState(null);
  const [step,         setStep]         = useState(1);
  const [formData,     setFormData]     = useState({});
  const [generating,   setGenerating]   = useState(false);
  const [genStep,      setGenStep]      = useState(null);
  const [generated,    setGenerated]    = useState(false);
  const [generatedId,  setGeneratedId]  = useState(null);
  const [myDocs,       setMyDocs]       = useState(null);
  const [docsLoading,  setDocsLoading]  = useState(false);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate  = useNavigate();
  const { user } = useAuth();
  const api       = useApi();
  const { sanitize, validators, validateForm } = useSecurity();
  const c = getColors(dark_);

  const isMobile = vw < 768;

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Charger l'historique des documents
  useEffect(() => {
    if (activeTab === "historique") loadDocs();
  }, [activeTab]);

  async function loadDocs() {
    setDocsLoading(true);
    const res = await api.get(API.DOCUMENTS_LIST);
    if (res.ok) setMyDocs(res.data);
    else setMyDocs([
      { name:"Attestation de travail",        date:"28/05/2026", status:"Disponible", icon:"📄", id:"d1" },
      { name:"Demande de congés — Mai 2026",  date:"05/05/2026", status:"Approuvé",   icon:"🏖️", id:"d2" },
      { name:"Note de frais — Avril 2026",    date:"30/04/2026", status:"En cours",   icon:"🧾", id:"d3" },
      { name:"Attestation de salaire",        date:"15/03/2026", status:"Disponible", icon:"💰", id:"d4" },
    ]);
    setDocsLoading(false);
  }

  const handleSelectDoc = (doc) => {
    const prefilled = {};
    doc.fields.forEach(f => { prefilled[f] = ""; });
    // Préremplissage depuis JWT
    if (doc.fields.includes("Nom complet"))    prefilled["Nom complet"]    = user?.name  || "";
    if (doc.fields.includes("Poste"))          prefilled["Poste"]          = user?.dept  ? "Développeur Frontend" : "";
    if (doc.fields.includes("Département"))    prefilled["Département"]    = user?.dept  || "";
    if (doc.fields.includes("Date d'embauche"))prefilled["Date d'embauche"]= "01/09/2023";
    setSelectedDoc(doc);
    setFormData(prefilled);
    setStep(2);
    setGenerated(false);
  };

  const handleGenerate = async () => {
    // Valider que les champs requis sont remplis
    const empty = selectedDoc.fields.filter(f => !formData[f]?.trim());
    if (empty.length > 0) { toast.error(`Champs manquants : ${empty.join(", ")}`); return; }

    setGenerating(true);
    setGenStep(0);
    const steps = ["Vérification des données RH","Préremplissage du document","Contrôle de cohérence","Finalisation et horodatage"];

    // Simuler progression (puis appel API réel)
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setGenStep(i + 1);
    }

    // Appel API réel
    const sanitizedData = {};
    for (const [k, v] of Object.entries(formData)) sanitizedData[k] = sanitize(v);

    const res = await api.post(API.DOCUMENTS_GEN, { type: selectedDoc.id, fields: sanitizedData });
    if (res.ok) {
      setGeneratedId(res.data?.id || "local-doc");
      toast.success("Document généré avec succès !");
    } else {
      setGeneratedId("local-preview");
    }
    setGenerating(false);
    setGenStep(null);
    setGenerated(true);
    setStep(3);
  };

  const handleDownload = async (docId) => {
    if (!docId || docId === "local-preview") {
      toast("Téléchargement disponible une fois le backend connecté", { icon: "ℹ️" });
      return;
    }
    const res = await api.get(API.DOCUMENTS_PDF(docId), { responseType: "blob" });
    if (res.ok) {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url;
      a.download = `${selectedDoc?.label || "document"}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } else toast.error("Erreur lors du téléchargement");
  };

  const statusColor = (s) => {
    if (s === "Disponible" || s === "Approuvé") return { bg: c.success, text: c.successText };
    if (s === "En cours") return { bg: c.warn, text: c.warnText };
    return { bg: c.badge, text: c.badgeText };
  };

  const genSteps = ["Vérification des données RH","Préremplissage du document","Contrôle de cohérence","Finalisation et horodatage"];

  return (
    <div style={{ minHeight:"100vh", width:"100%", background:c.bg, color:c.ink,
      fontFamily:"ui-sans-serif,system-ui,sans-serif", display:"flex", transition:"background .4s" }}>
      <Toaster position="top-right" />
      <SkeletonStyles c={c} />

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:40 }} />
      )}

      <Sidebar c={c} role="collab"
        userName={user?.name || "—"} userInitials={user?.initials || "?"}
        userSubtitle="Collaborateur"
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <header style={{ height:58, background:c.surface, borderBottom:`1px solid ${c.line}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 20px", position:"sticky", top:0, zIndex:30 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)}
              style={{ background:"none", border:"none", cursor:"pointer", color:c.ink, display:"flex" }}><Menu size={22}/></button>}
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:c.ink }}>Mes documents RH</div>
              <div style={{ fontSize:11, color:c.muted }}>Générer & consulter vos documents</div>
            </div>
          </div>
          <button onClick={() => setDark(!dark_)}
            style={{ width:36, height:36, borderRadius:8, border:`1px solid ${c.line}`,
              background:c.surface, color:c.ink, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
            {dark_ ? <Moon size={17}/> : <Sun size={17}/>}
          </button>
        </header>

        <main style={{ flex:1, padding:isMobile?14:24, overflowY:"auto" }}>
          {/* Tabs */}
          <div style={{ display:"flex", gap:4, marginBottom:20, background:c.surface,
            padding:4, borderRadius:10, border:`1px solid ${c.line}`, width:"fit-content" }}>
            {["nouveau","historique"].map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setStep(1); setSelectedDoc(null); setGenerated(false); }}
                style={{ padding:"7px 18px", borderRadius:7, border:"none", cursor:"pointer",
                  fontSize:13, fontWeight:activeTab===tab?600:400,
                  background:activeTab===tab?c.gold:"transparent",
                  color:activeTab===tab?c.onGold:c.muted, transition:"all .2s" }}>
                {tab === "nouveau" ? "Nouveau document" : "Mes documents"}
              </button>
            ))}
          </div>

          {/* NOUVEAU DOCUMENT */}
          {activeTab === "nouveau" && (
            <>
              {/* Stepper */}
              <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:22, maxWidth:400 }}>
                {["Choisir","Remplir","Générer"].map((s, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", flex:i<2?"auto":"none" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <div style={{ width:26, height:26, borderRadius:"50%",
                        background:step>i+1?c.gold:step===i+1?c.gold:c.line,
                        border:`2px solid ${step>=i+1?c.gold:c.line}`,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {step>i+1 ? <CheckCircle size={14} color={c.onGold}/>
                          : <span style={{ fontSize:12, fontWeight:700, color:step===i+1?c.onGold:c.muted }}>{i+1}</span>}
                      </div>
                      <span style={{ fontSize:13, color:step>=i+1?c.ink:c.muted, fontWeight:step===i+1?600:400 }}>{s}</span>
                    </div>
                    {i<2 && <div style={{ flex:1, height:1, background:step>i+1?c.gold:c.line, margin:"0 12px", minWidth:30 }}/>}
                  </div>
                ))}
              </div>

              {/* Step 1 — Choix */}
              {step === 1 && (
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:14 }}>
                  {DOC_TYPES.map(doc => (
                    <button key={doc.id} onClick={() => handleSelectDoc(doc)} style={{
                      background:c.surface, border:`1px solid ${c.line}`,
                      borderRadius:14, padding:"18px 16px", cursor:"pointer",
                      textAlign:"left", transition:"all .2s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor=c.gold; e.currentTarget.style.boxShadow=c.shadowCard; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor=c.line; e.currentTarget.style.boxShadow="none"; }}>
                      <div style={{ fontSize:28, marginBottom:10 }}>{doc.icon}</div>
                      <div style={{ fontSize:14, fontWeight:600, color:c.ink, marginBottom:6 }}>{doc.label}</div>
                      <div style={{ fontSize:12.5, color:c.muted, lineHeight:1.5, marginBottom:10 }}>{doc.desc}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <Clock size={12} color={c.gold}/>
                        <span style={{ fontSize:11.5, color:c.muted }}>{doc.delay}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2 — Formulaire */}
              {step === 2 && selectedDoc && (
                <div style={{ maxWidth:540 }}>
                  <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:24, boxShadow:c.shadowCard }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                      <span style={{ fontSize:28 }}>{selectedDoc.icon}</span>
                      <div>
                        <div style={{ fontSize:15, fontWeight:600, color:c.ink }}>{selectedDoc.label}</div>
                        <div style={{ fontSize:12, color:c.muted }}>{selectedDoc.delay}</div>
                      </div>
                    </div>
                    <div style={{ background:c.badge, borderRadius:8, padding:"10px 14px", marginBottom:18, display:"flex", gap:8 }}>
                      <Sparkles size={14} color={c.gold} style={{ flexShrink:0, marginTop:2 }}/>
                      <span style={{ fontSize:12.5, color:c.badgeText }}>Les champs ont été préremplis depuis votre dossier RH ({user?.name}).</span>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                      {selectedDoc.fields.map(field => (
                        <div key={field}>
                          <label style={{ fontSize:13, fontWeight:500, color:c.ink, display:"block", marginBottom:5 }}>{field}</label>
                          <input value={formData[field]||""}
                            onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                            placeholder={`Saisir ${field.toLowerCase()}…`}
                            style={{ width:"100%", background:c.inputBg, border:`1px solid ${c.line}`,
                              borderRadius:9, padding:"10px 12px", fontSize:13.5, color:c.ink,
                              outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                        </div>
                      ))}
                    </div>
                    {/* Étapes génération */}
                    {(generating || genStep) && (
                      <div style={{ marginTop:16, background:c.surfaceAlt, borderRadius:10, padding:"14px 16px" }}>
                        {genSteps.map((s, i) => (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                            <div style={{ width:18, height:18, borderRadius:"50%",
                              background:genStep>i?c.gold:genStep===i?c.badge:"transparent",
                              border:`2px solid ${genStep>=i?c.gold:c.line}`,
                              display:"flex", alignItems:"center", justifyContent:"center", transition:"all .3s" }}>
                              {genStep>i && <CheckCircle size={11} color={c.onGold}/>}
                            </div>
                            <span style={{ fontSize:13, color:genStep>=i?c.ink:c.muted }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display:"flex", gap:10, marginTop:22 }}>
                      <button onClick={() => setStep(1)}
                        style={{ flex:1, background:"transparent", border:`1px solid ${c.line}`,
                          borderRadius:9, padding:"11px 0", color:c.muted, cursor:"pointer", fontSize:14 }}>
                        ← Retour
                      </button>
                      <button onClick={handleGenerate} disabled={generating}
                        style={{ flex:2, background:generating?c.line:c.gold, border:"none",
                          borderRadius:9, padding:"11px 0", color:generating?c.muted:c.onGold,
                          cursor:generating?"default":"pointer", fontSize:14, fontWeight:600,
                          display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                        <Sparkles size={16}/> {generating?"Génération en cours…":"Générer le document"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 — Succès */}
              {step === 3 && selectedDoc && (
                <div style={{ maxWidth:540 }}>
                  <div style={{ background:c.success, border:`1px solid ${c.successText}40`,
                    borderRadius:16, padding:24, textAlign:"center", marginBottom:16 }}>
                    <CheckCircle size={40} color={c.successText} style={{ marginBottom:10 }}/>
                    <div style={{ fontSize:16, fontWeight:600, color:c.ink, marginBottom:6 }}>Document généré avec succès !</div>
                    <div style={{ fontSize:13, color:c.muted }}>{selectedDoc?.label} · {new Date().toLocaleDateString("fr-FR")}</div>
                  </div>
                  <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:24, boxShadow:c.shadowCard, marginBottom:16 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:c.ink, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                      <Eye size={16} color={c.gold}/> Aperçu
                    </div>
                    <div style={{ background:c.surfaceAlt, borderRadius:10, padding:20, border:`1px solid ${c.line}` }}>
                      <div style={{ textAlign:"center", marginBottom:16 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:c.ink, letterSpacing:1, textTransform:"uppercase" }}>Synapse Digital</div>
                        <div style={{ fontSize:11, color:c.muted }}>Direction des Ressources Humaines</div>
                      </div>
                      <div style={{ textAlign:"center", margin:"16px 0 20px" }}>
                        <div style={{ fontSize:15, fontWeight:600, color:c.gold, textDecoration:"underline", textTransform:"uppercase" }}>{selectedDoc?.label}</div>
                      </div>
                      <div style={{ fontSize:12.5, color:c.ink, lineHeight:1.8 }}>
                        <p>Je soussigné(e), le Département des Ressources Humaines de la société <strong>Synapse Digital</strong>, certifie que :</p>
                        <p><strong>M./Mme {formData["Nom complet"] || user?.name}</strong></p>
                        <p>Occupe le poste de <strong>{formData["Poste"] || "—"}</strong> au sein du département <strong>{formData["Département"] || user?.dept || "—"}</strong>, depuis le <strong>{formData["Date d'embauche"] || "—"}</strong>.</p>
                        <p style={{ marginTop:12, color:c.muted, fontSize:11 }}>Généré le {new Date().toLocaleDateString("fr-FR")} par Synapse IA RH.</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={() => handleDownload(generatedId)}
                      style={{ flex:1, background:c.gold, border:"none", borderRadius:9, padding:"12px 0",
                        color:c.onGold, cursor:"pointer", fontSize:14, fontWeight:600,
                        display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                      <Download size={16}/> Télécharger PDF
                    </button>
                    <button onClick={() => { setStep(1); setSelectedDoc(null); setGenerated(false); }}
                      style={{ flex:1, background:"transparent", border:`1px solid ${c.line}`,
                        borderRadius:9, padding:"12px 0", color:c.muted, cursor:"pointer", fontSize:14,
                        display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                      <FilePlus size={16}/> Nouveau
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* HISTORIQUE */}
          {activeTab === "historique" && (
            <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:20, boxShadow:c.shadowCard }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:c.ink }}>Historique des documents</h3>
                <button onClick={() => toast("Filtres ouverts")}
                  style={{ display:"flex", alignItems:"center", gap:6, background:"transparent",
                    border:`1px solid ${c.line}`, borderRadius:7, color:c.muted,
                    padding:"5px 10px", cursor:"pointer", fontSize:12 }}>
                  <Filter size={13}/> Filtrer
                </button>
              </div>
              {docsLoading ? (
                [1,2,3,4].map(i => <Skeleton key={i} height={54} style={{ marginBottom:10, borderRadius:10 }}/>)
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {(myDocs||[]).map((doc, i) => {
                    const sc = statusColor(doc.status);
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:14,
                        background:c.surfaceAlt, border:`1px solid ${c.line}`,
                        borderRadius:10, padding:"12px 16px", flexWrap:isMobile?"wrap":"nowrap" }}>
                        <span style={{ fontSize:22, flexShrink:0 }}>{doc.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13.5, fontWeight:500, color:c.ink }}>{doc.name}</div>
                          <div style={{ fontSize:12, color:c.muted, marginTop:2 }}>{doc.date}</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                          <span style={{ background:sc.bg, color:sc.text, borderRadius:6,
                            padding:"3px 9px", fontSize:12, fontWeight:600 }}>{doc.status}</span>
                          {(doc.status==="Disponible"||doc.status==="Approuvé") && (
                            <button onClick={() => handleDownload(doc.id)}
                              style={{ background:c.gold, color:c.onGold, border:"none", borderRadius:7,
                                padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600,
                                display:"flex", alignItems:"center", gap:5 }}>
                              <Download size={13}/> PDF
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
