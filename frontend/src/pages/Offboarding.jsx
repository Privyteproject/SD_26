import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Sun, Moon, CheckCircle, AlertTriangle, FileText,
  ChevronDown, Download, Menu, LogOut, Settings,
  LayoutDashboard, MessageSquare, Calendar, Archive,
  Clock, Send, BookOpen, Key, Laptop, Users, Check, X
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useApi, API } from "../auth/useApi";
import { getColors } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { Skeleton, SkeletonStyles } from "../components/Skeleton";
import toast, { Toaster } from "react-hot-toast";

const DEMO_OFFBOARDING = {
  collaborateur: { name:"Arush Ramisami", poste:"Développeur Frontend", dept:"Tech & Produit", anciennete:"2 ans 9 mois", depart:"30/06/2026", type:"Démission" },
  categories: [
    { key:"documents", label:"Documents administratifs", icon:"📄", color:"gold",
      items:[
        { id:"d1", label:"Lettre de démission reçue",                done:true  },
        { id:"d2", label:"Solde de tout compte calculé et validé",    done:true  },
        { id:"d3", label:"Attestation de travail générée",            done:false },
        { id:"d4", label:"Certificat de travail préparé",             done:false },
        { id:"d5", label:"Reçu pour solde de tout compte signé",      done:false },
      ]},
    { key:"materiel", label:"Restitution du matériel", icon:"💻", color:"warn",
      items:[
        { id:"m1", label:"Ordinateur portable restitué et effacé",    done:true  },
        { id:"m2", label:"Badge d'accès rendu",                       done:false },
        { id:"m3", label:"Téléphone professionnel rendu",             done:false },
        { id:"m4", label:"Carte carburant désactivée",                done:false },
      ]},
    { key:"acces", label:"Révocation des accès", icon:"🔑", color:"danger",
      items:[
        { id:"a1", label:"Compte Active Directory désactivé",         done:false },
        { id:"a2", label:"Accès Jira, Confluence, Slack révoqués",    done:false },
        { id:"a3", label:"Accès VPN supprimé",                        done:false },
        { id:"a4", label:"Email archivé et redirigé",                 done:false },
        { id:"a5", label:"Droits Git retirés",                        done:false },
      ]},
    { key:"transfert", label:"Transfert de connaissances", icon:"📚", color:"info",
      items:[
        { id:"t1", label:"Dossiers en cours documentés",              done:false },
        { id:"t2", label:"Contacts clés informés",                    done:false },
        { id:"t3", label:"Procédures partagées en sécurité",          done:false },
        { id:"t4", label:"Synthèse de transfert rédigée et validée",  done:false },
      ]},
    { key:"entretien", label:"Entretien de sortie", icon:"🤝", color:"success",
      items:[
        { id:"e1", label:"Entretien de sortie planifié avec RH",      done:false },
        { id:"e2", label:"Questionnaire d'évaluation rempli",         done:false },
        { id:"e3", label:"Feedback collaborateur collecté",           done:false },
      ]},
  ],
  documents:[
    { icon:"📄", label:"Attestation de travail",    status:"Prête",      id:"doc1" },
    { icon:"📋", label:"Certificat de travail",     status:"En attente", id:"doc2" },
    { icon:"💰", label:"Solde de tout compte",       status:"En cours",   id:"doc3" },
    { icon:"📝", label:"Reçu pour solde signé",     status:"En attente", id:"doc4" },
    { icon:"📊", label:"Synthèse de transfert",     status:"À générer",  id:"doc5" },
  ],
};

export default function Offboarding({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [activeTab,    setActiveTab]    = useState("checklist");
  const [expandedCat,  setExpandedCat]  = useState(0);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [generating,   setGenerating]   = useState(false);
  const [synthese,     setSynthese]     = useState("");
  const [syntheseDone, setSyntheseDone] = useState(false);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate  = useNavigate();
  const { id: offboardingId } = useParams();
  const { user } = useAuth();
  const api       = useApi();
  const c = getColors(dark_);
  const isMobile  = vw < 768;

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await api.get(API.OFFBOARDING(offboardingId || "me"));
    setData(res.ok ? res.data : DEMO_OFFBOARDING);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleItem = async (catKey, itemId) => {
    const updated = JSON.parse(JSON.stringify(data));
    const cat = updated.categories.find(c => c.key === catKey);
    const item = cat.items.find(i => i.id === itemId);
    item.done = !item.done;
    setData(updated);
    const res = await api.patch(API.OFFBOARDING_STEP(itemId), { done: item.done });
    if (!res.ok) toast.error("Erreur mise à jour");
    else toast.success(item.done ? "✓ Étape complétée" : "Étape réouverte");
  };

  const handleGenerateSynthese = async () => {
    setGenerating(true);
    const steps = [
      "Analyse des projets en cours…",
      "Extraction des contacts clés…",
      "Identification des outils critiques…",
      "Rédaction de la synthèse…",
    ];
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 700));
      toast(steps[i], { icon: "⚙️" });
    }
    const res = await api.post(API.OFFBOARDING_SYNTHESE, { userId: "me" });
    setSynthese(res.ok && res.data?.content ? res.data.content : `## Synthèse de transfert — ${data?.collaborateur?.name || user?.name}
**Date de départ :** ${data?.collaborateur?.depart || "—"}
**Poste :** ${data?.collaborateur?.poste || "—"}

### Projets en cours
- Dashboard RH Synapse : livraison Sprint 14. Passation à l'équipe Tech.
- Migration composants v2 : 80% complété. Documentation dans Confluence.

### Accès & outils critiques
- Repo GitHub : synapse-frontend — droits à révoquer après passation
- Figma workspace : partager avec l'équipe design
- Credentials AWS staging : transférer au lead tech

### Contacts clés externes
- Prestataire UX : claire@uxlab.ma
- API partenaire : contact@partnerapi.com

### Notes importantes
La branche feat/auth-refactor doit être mergée avant le départ (ticket SYN-412).`);
    setGenerating(false);
    setSyntheseDone(true);
    toast.success("Synthèse générée !");
  };

  const allItems = data?.categories?.flatMap(c => c.items) || [];
  const doneCount = allItems.filter(i => i.done).length;
  const progress  = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;

  const colMap = (color) => ({
    gold:    { bg: `${c.gold}18`,    text: c.gold,        border: c.gold        },
    warn:    { bg: c.warn,           text: c.warnText,    border: c.warnText    },
    danger:  { bg: c.danger,        text: c.dangerText,  border: c.dangerText  },
    info:    { bg: c.info,           text: c.infoText,    border: c.infoText    },
    success: { bg: c.success,        text: c.successText, border: c.successText },
  }[color] || { bg: c.badge, text: c.badgeText, border: c.gold });

  const statusColor = (s) => {
    if (s === "Prête")      return { bg: c.success, text: c.successText };
    if (s === "En cours")   return { bg: c.warn,    text: c.warnText    };
    if (s === "En attente") return { bg: c.badge,   text: c.badgeText   };
    return                         { bg: c.danger,  text: c.dangerText  };
  };

  const tabs = [
    { key: "checklist",  label: "Checklist conformité"      },
    { key: "transfert",  label: "Transfert de connaissances" },
    { key: "documents",  label: "Documents de sortie"        },
  ];

  const collab = data?.collaborateur;

  return (
    <div style={{ minHeight:"100vh", width:"100%", background:c.bg, color:c.ink,
      fontFamily:"ui-sans-serif,system-ui,sans-serif", display:"flex", transition:"background .4s" }}>
      <Toaster position="top-right"/>
      <SkeletonStyles c={c}/>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:40 }}/>
      )}

      <Sidebar c={c} role="rh"
        userName={user?.name||"—"} userInitials={user?.initials||"?"}
        userSubtitle="Responsable RH"
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)}/>

      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <header style={{ height:58, background:c.surface, borderBottom:`1px solid ${c.line}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 20px", position:"sticky", top:0, zIndex:30 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)}
              style={{ background:"none", border:"none", cursor:"pointer", color:c.ink, display:"flex" }}><Menu size={22}/></button>}
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:c.ink }}>Processus d'offboarding</div>
              <div style={{ fontSize:11, color:c.muted }}>
                {collab ? `${collab.name} · Départ le ${collab.depart}` : "Chargement…"}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => toast("Export rapport en cours…", { icon:"📊" })}
              style={{ display:"flex", alignItems:"center", gap:6, background:c.gold,
                color:c.onGold, border:"none", borderRadius:8, padding:"7px 12px",
                cursor:"pointer", fontSize:12.5, fontWeight:600 }}>
              <Download size={14}/> Rapport complet
            </button>
            <button onClick={() => setDark(!dark_)}
              style={{ width:36, height:36, borderRadius:8, border:`1px solid ${c.line}`,
                background:c.surface, color:c.ink, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
              {dark_?<Moon size={17}/>:<Sun size={17}/>}
            </button>
          </div>
        </header>

        <main style={{ flex:1, padding:isMobile?14:24, overflowY:"auto" }}>
          {/* Hero */}
          {loading ? (
            <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:18, padding:24, marginBottom:22 }}>
              <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                <Skeleton width={56} height={56} radius={28}/>
                <div style={{ flex:1 }}>
                  <Skeleton height={18} width={200} style={{ marginBottom:8 }}/>
                  <Skeleton height={12} width={280}/>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:18,
              padding:isMobile?18:24, marginBottom:22, boxShadow:c.shadowCard,
              display:"flex", flexDirection:isMobile?"column":"row", gap:20, alignItems:isMobile?"flex-start":"center" }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:c.badge,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:18, fontWeight:700, color:c.goldDeep }}>
                  {collab?.name?.split(" ").map(n=>n[0]).join("").slice(0,2)||"?"}
                </span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:17, fontWeight:700, color:c.ink }}>{collab?.name}</div>
                <div style={{ fontSize:13, color:c.muted, marginTop:2 }}>
                  {collab?.poste} · {collab?.dept} · {collab?.anciennete}
                </div>
                <div style={{ display:"flex", gap:10, marginTop:8, flexWrap:"wrap" }}>
                  <span style={{ background:c.warn, color:c.warnText, borderRadius:6, padding:"3px 10px", fontSize:12, fontWeight:500 }}>
                    {collab?.type}
                  </span>
                  <span style={{ fontSize:12, color:c.muted, display:"flex", alignItems:"center", gap:4 }}>
                    <Clock size={12}/> Départ : {collab?.depart}
                  </span>
                </div>
              </div>
              <div style={{ flexShrink:0, textAlign:isMobile?"left":"right" }}>
                <div style={{ fontSize:28, fontWeight:700, color:c.ink }}>{progress}%</div>
                <div style={{ fontSize:12, color:c.muted }}>Processus complété</div>
                <div style={{ height:6, background:c.line, borderRadius:3, marginTop:6, width:120, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${progress}%`, background:c.gold, borderRadius:3, transition:"width .5s" }}/>
                </div>
                <div style={{ fontSize:11, color:c.muted, marginTop:4 }}>{doneCount}/{allItems.length} étapes</div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:"flex", gap:4, marginBottom:20, background:c.surface,
            padding:4, borderRadius:12, border:`1px solid ${c.line}`, flexWrap:"wrap" }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                flex:isMobile?"none":1, padding:"8px 16px", borderRadius:8, border:"none",
                cursor:"pointer", fontSize:13, fontWeight:activeTab===tab.key?600:400,
                background:activeTab===tab.key?c.gold:"transparent",
                color:activeTab===tab.key?c.onGold:c.muted, transition:"all .2s" }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* CHECKLIST */}
          {activeTab === "checklist" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {loading ? [1,2,3,4,5].map(i => <Skeleton key={i} height={64} style={{ borderRadius:14 }}/>) : (
                (data?.categories||[]).map((cat, ci) => {
                  const col     = colMap(cat.color);
                  const catDone = cat.items.filter(i => i.done).length;
                  const isExp   = expandedCat === ci;
                  return (
                    <div key={ci} style={{ background:c.surface, border:`1px solid ${c.line}`,
                      borderRadius:14, overflow:"hidden", boxShadow:c.shadowCard,
                      borderLeft:`4px solid ${col.border}` }}>
                      <button onClick={() => setExpandedCat(isExp?-1:ci)} style={{
                        width:"100%", display:"flex", alignItems:"center", gap:14,
                        padding:"16px 20px", background:"transparent", border:"none",
                        cursor:"pointer", textAlign:"left" }}>
                        <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                          background:col.bg, display:"flex", alignItems:"center",
                          justifyContent:"center", fontSize:20 }}>
                          {cat.icon}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:600, color:c.ink }}>{cat.label}</div>
                          <div style={{ fontSize:12, color:c.muted, marginTop:2 }}>
                            {catDone}/{cat.items.length} complétées
                          </div>
                          <div style={{ height:3, background:`${col.border}25`, borderRadius:2, marginTop:6, maxWidth:180, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${(catDone/cat.items.length)*100}%`, background:col.border, borderRadius:2 }}/>
                          </div>
                        </div>
                        {catDone===cat.items.length && <CheckCircle size={20} color={c.successText}/>}
                        <ChevronDown size={17} color={c.muted}
                          style={{ transform:isExp?"rotate(180deg)":"none", transition:"transform .2s" }}/>
                      </button>
                      {isExp && (
                        <div style={{ borderTop:`1px solid ${c.line}`, padding:"10px 20px 16px" }}>
                          {cat.items.map((item) => (
                            <div key={item.id} style={{
                              display:"flex", alignItems:"center", gap:12,
                              padding:"10px 0",
                              borderBottom:`1px solid ${c.line}`,
                              cursor:"pointer" }}
                              onClick={() => toggleItem(cat.key, item.id)}>
                              <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                                background:item.done?c.gold:"transparent",
                                border:`2px solid ${item.done?c.gold:c.line}`,
                                display:"flex", alignItems:"center", justifyContent:"center",
                                transition:"all .2s" }}>
                                {item.done && <Check size={13} color={c.onGold} strokeWidth={3}/>}
                              </div>
                              <span style={{ fontSize:13.5, color:item.done?c.muted:c.ink,
                                textDecoration:item.done?"line-through":"none", flex:1 }}>
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TRANSFERT */}
          {activeTab === "transfert" && (
            <div style={{ maxWidth:680, display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:c.info, borderRadius:12, padding:"14px 18px",
                display:"flex", gap:10, alignItems:"flex-start" }}>
                <AlertTriangle size={16} color={c.infoText} style={{ flexShrink:0, marginTop:2 }}/>
                <span style={{ fontSize:13, color:c.infoText }}>
                  La synthèse est générée automatiquement par l'IA depuis les projets, outils et contacts du collaborateur.
                  Vous pouvez la modifier avant validation RH.
                </span>
              </div>
              <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:22, boxShadow:c.shadowCard }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <h3 style={{ fontSize:15, fontWeight:600, color:c.ink }}>Synthèse de transfert</h3>
                  {!syntheseDone && (
                    <button onClick={handleGenerateSynthese} disabled={generating}
                      style={{ display:"flex", alignItems:"center", gap:6,
                        background:generating?c.line:c.gold, color:generating?c.muted:c.onGold,
                        border:"none", borderRadius:9, padding:"8px 14px",
                        cursor:generating?"default":"pointer", fontSize:13, fontWeight:600 }}>
                      ✨ {generating?"Génération…":"Générer avec l'IA"}
                    </button>
                  )}
                </div>
                {!syntheseDone && !generating && (
                  <div style={{ background:c.surfaceAlt, borderRadius:10, padding:"28px 0",
                    textAlign:"center", border:`2px dashed ${c.line}` }}>
                    <BookOpen size={32} color={c.muted} style={{ margin:"0 auto 12px" }}/>
                    <div style={{ fontSize:14, color:c.muted }}>
                      Cliquez sur "Générer avec l'IA" pour créer la synthèse automatiquement
                    </div>
                  </div>
                )}
                {generating && (
                  <div style={{ padding:"10px 0" }}>
                    {["Analyse projets","Extraction contacts","Outils critiques","Rédaction"].map((s,i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <div style={{ width:20, height:20, borderRadius:"50%", background:c.badge,
                          border:`2px solid ${c.gold}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <div style={{ width:6, height:6, borderRadius:"50%", background:c.gold,
                            animation:"pulse 1s ease infinite" }}/>
                        </div>
                        <span style={{ fontSize:13, color:c.muted }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {syntheseDone && (
                  <>
                    <textarea value={synthese} onChange={e => setSynthese(e.target.value)}
                      style={{ width:"100%", minHeight:280, background:c.inputBg||c.field,
                        border:`1px solid ${c.line}`, borderRadius:10, padding:"14px 16px",
                        fontSize:13, color:c.ink, fontFamily:"ui-monospace,monospace",
                        outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.7 }}/>
                    <div style={{ display:"flex", gap:10, marginTop:14 }}>
                      <button onClick={() => toast.success("Synthèse envoyée au RH pour validation")}
                        style={{ flex:1, background:c.gold, color:c.onGold, border:"none",
                          borderRadius:9, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:600,
                          display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                        <Send size={15}/> Envoyer pour validation RH
                      </button>
                      <button onClick={() => toast("Téléchargement PDF disponible après connexion backend", { icon:"ℹ️" })}
                        style={{ background:"transparent", border:`1px solid ${c.line}`,
                          borderRadius:9, padding:"11px 16px", cursor:"pointer", fontSize:14, color:c.muted,
                          display:"flex", alignItems:"center", gap:6 }}>
                        <Download size={15}/> PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* DOCUMENTS */}
          {activeTab === "documents" && (
            <div style={{ maxWidth:600, display:"flex", flexDirection:"column", gap:12 }}>
              {loading ? [1,2,3,4,5].map(i => <Skeleton key={i} height={60} style={{ borderRadius:12 }}/>) : (
                (data?.documents||[]).map((doc, i) => {
                  const sc = statusColor(doc.status);
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:14,
                      background:c.surface, border:`1px solid ${c.line}`,
                      borderRadius:12, padding:"14px 18px", boxShadow:c.shadowCard }}>
                      <span style={{ fontSize:24, flexShrink:0 }}>{doc.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:500, color:c.ink }}>{doc.label}</div>
                      </div>
                      <span style={{ background:sc.bg, color:sc.text, borderRadius:6,
                        padding:"3px 10px", fontSize:12, fontWeight:600, flexShrink:0 }}>
                        {doc.status}
                      </span>
                      {doc.status === "Prête" && (
                        <button onClick={() => toast("Téléchargement disponible après connexion backend", { icon:"ℹ️" })}
                          style={{ background:c.gold, color:c.onGold, border:"none", borderRadius:8,
                            padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600,
                            display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                          <Download size={13}/> PDF
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}`}</style>
    </div>
  );
}
