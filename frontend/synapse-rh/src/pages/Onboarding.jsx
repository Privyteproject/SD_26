import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun, Moon, CheckCircle, Circle, Clock, Calendar,
  ChevronDown, Menu, LogOut, Settings, FileText,
  LayoutDashboard, MessageSquare, Users, Award, BookOpen
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useApi, API } from "../auth/useApi";
import { getColors } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { Skeleton, SkeletonStyles } from "../components/Skeleton";
import toast, { Toaster } from "react-hot-toast";

const DEMO_ONBOARDING = {
  currentDay: 5,
  weeks: [
    { week:"Semaine 1", subtitle:"Découverte & installation", days:"J1 → J5",
      steps:[
        { label:"Accueil par le manager et l'équipe RH", done:true,  day:"J1", type:"rencontre" },
        { label:"Configuration poste de travail et accès",done:true,  day:"J1", type:"technique" },
        { label:"Présentation de la culture d'entreprise", done:true,  day:"J2", type:"formation" },
        { label:"Formation sécurité informatique",         done:true,  day:"J3", type:"formation" },
        { label:"Visite des locaux & présentation équipes",done:false, day:"J4", type:"rencontre" },
        { label:"Lecture du guide interne collaborateur",  done:false, day:"J5", type:"lecture"  },
      ]},
    { week:"Semaine 2", subtitle:"Immersion métier", days:"J6 → J10",
      steps:[
        { label:"Rencontre avec votre équipe directe",     done:false, day:"J6",  type:"rencontre" },
        { label:"Présentation des outils et processus",    done:false, day:"J7",  type:"technique" },
        { label:"Premier stand-up meeting",                done:false, day:"J8",  type:"rencontre" },
        { label:"Formation outils internes",               done:false, day:"J9",  type:"formation" },
        { label:"Première tâche confiée par le manager",   done:false, day:"J10", type:"mission"  },
      ]},
    { week:"Semaines 3 & 4", subtitle:"Montée en compétences", days:"J11 → J20",
      steps:[
        { label:"Point d'étape bilan S2",                  done:false, day:"J11", type:"rencontre" },
        { label:"Parcours e-learning React avancé",        done:false, day:"J12", type:"formation" },
        { label:"Sprint planning agile",                   done:false, day:"J14", type:"mission"  },
        { label:"Rencontre responsable QVT",               done:false, day:"J15", type:"rencontre" },
        { label:"Contribution feature en production",      done:false, day:"J18", type:"mission"  },
      ]},
    { week:"Fin du 1er mois", subtitle:"Bilan & projection", days:"J21 → J30",
      steps:[
        { label:"Bilan 30 jours avec manager et RH",       done:false, day:"J21", type:"rencontre" },
        { label:"Auto-évaluation intégration",             done:false, day:"J25", type:"formation" },
        { label:"Définition objectifs trimestre",          done:false, day:"J28", type:"mission"  },
        { label:"Validation période d'essai",              done:false, day:"J30", type:"mission"  },
      ]},
  ],
  contacts:[
    { name:"Marie Rousseau", role:"Responsable RH",    avatar:"MR", tag:"RH"      },
    { name:"Thomas Leroy",   role:"Manager direct",    avatar:"TL", tag:"Manager" },
    { name:"Yasmine Idris",  role:"Buddy / Parrain",   avatar:"YI", tag:"Buddy"   },
    { name:"IT Support",     role:"Assistance technique",avatar:"IT",tag:"Tech"   },
  ],
  resources:[
    { icon:"📘", label:"Guide collaborateur complet",          type:"PDF" },
    { icon:"🔐", label:"Politique de sécurité informatique",   type:"PDF" },
    { icon:"🏖️", label:"Politique de congés & absences",      type:"PDF" },
    { icon:"🏠", label:"Guide télétravail 2026",               type:"PDF" },
    { icon:"💬", label:"Rejoindre les canaux Slack",           type:"Lien"},
  ],
};

export default function Onboarding({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [expandedWeek, setExpandedWeek] = useState(0);
  const [onboarding,   setOnboarding]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate  = useNavigate();
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
  const loadOnboarding = useCallback(async () => {
    setLoading(true);
    const res = await api.get(API.ONBOARDING);
    setOnboarding(res.ok ? res.data : DEMO_ONBOARDING);
    setLoading(false);
  }, []);

  useEffect(() => { loadOnboarding(); }, [loadOnboarding]);

  const toggleStep = async (weekIdx, stepIdx) => {
    const updated = JSON.parse(JSON.stringify(onboarding));
    const step = updated.weeks[weekIdx].steps[stepIdx];
    step.done = !step.done;
    setOnboarding(updated);
    const res = await api.patch(API.ONBOARDING_STEP(`w${weekIdx}s${stepIdx}`), { done: step.done });
    if (!res.ok) toast.error("Erreur lors de la mise à jour");
    else toast.success(step.done ? "Étape complétée !" : "Étape marquée en cours");
  };

  const allSteps    = onboarding?.weeks?.flatMap(w => w.steps) || [];
  const doneCount   = allSteps.filter(s => s.done).length;
  const totalCount  = allSteps.length;
  const progress    = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const currentDay  = onboarding?.currentDay || 1;

  const typeInfo = (type) => {
    const map = {
      rencontre: { bg:c.info,    text:c.infoText,    label:"Rencontre" },
      technique: { bg:c.badge,   text:c.badgeText,   label:"Technique" },
      formation: { bg:c.warn,    text:c.warnText,    label:"Formation" },
      lecture:   { bg:c.success, text:c.successText, label:"Lecture"   },
      mission:   { bg:c.mission, text:c.missionText, label:"Mission"   },
    };
    return map[type] || map["lecture"];
  };

  return (
    <div style={{ minHeight:"100vh", width:"100%", background:c.bg, color:c.ink,
      fontFamily:"ui-sans-serif,system-ui,sans-serif", display:"flex", transition:"background .4s" }}>
      <Toaster position="top-right"/>
      <SkeletonStyles c={c}/>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:40 }}/>
      )}

      <Sidebar c={c} role="collab"
        userName={user?.name||"—"} userInitials={user?.initials||"?"}
        userSubtitle={`Collaborateur · Jour ${currentDay}`}
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)}/>

      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <header style={{ height:58, background:c.surface, borderBottom:`1px solid ${c.line}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 20px", position:"sticky", top:0, zIndex:30 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)}
              style={{ background:"none", border:"none", cursor:"pointer", color:c.ink, display:"flex" }}><Menu size={22}/></button>}
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:c.ink }}>Mon parcours d'intégration</div>
              <div style={{ fontSize:11, color:c.muted }}>30 jours · Synapse Digital</div>
            </div>
          </div>
          <button onClick={() => setDark(!dark_)}
            style={{ width:36, height:36, borderRadius:8, border:`1px solid ${c.line}`,
              background:c.surface, color:c.ink, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
            {dark_?<Moon size={17}/>:<Sun size={17}/>}
          </button>
        </header>

        <main style={{ flex:1, padding:isMobile?14:24, overflowY:"auto" }}>
          {/* Hero */}
          {loading ? (
            <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:18, padding:24, marginBottom:22 }}>
              <Skeleton height={28} width="40%" style={{ marginBottom:12 }}/>
              <Skeleton height={8} style={{ marginBottom:8 }}/>
              <Skeleton height={12} width="30%"/>
            </div>
          ) : (
            <div style={{ background:`linear-gradient(135deg,${c.gold}22,${c.goldDeep}10)`,
              border:`1px solid ${c.gold}40`, borderRadius:18,
              padding:isMobile?"18px 16px":"24px 28px", marginBottom:22,
              position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", right:-20, top:-20, width:150, height:150,
                borderRadius:"50%", background:`${c.gold}08`, pointerEvents:"none" }}/>
              <div style={{ display:"flex", flexDirection:isMobile?"column":"row",
                gap:20, alignItems:isMobile?"flex-start":"center" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase",
                    color:c.goldDeep, fontWeight:600, marginBottom:6 }}>Progression onboarding</div>
                  <div style={{ fontSize:isMobile?26:32, fontWeight:700, color:c.ink, marginBottom:8 }}>
                    Jour {currentDay} <span style={{ fontSize:16, color:c.muted, fontWeight:400 }}>/ 30</span>
                  </div>
                  <div style={{ height:8, background:`${c.gold}25`, borderRadius:4, overflow:"hidden", maxWidth:400 }}>
                    <div style={{ height:"100%", width:`${progress}%`,
                      background:`linear-gradient(90deg,${c.gold},${c.goldDeep})`,
                      borderRadius:4, transition:"width .6s" }}/>
                  </div>
                  <div style={{ fontSize:13, color:c.muted, marginTop:8 }}>
                    {doneCount}/{totalCount} étapes · {progress}%
                  </div>
                </div>
                <div style={{ display:"flex", gap:12, flexShrink:0, flexWrap:"wrap" }}>
                  {[
                    { label:"Faites",    value:doneCount,          icon:<CheckCircle size={18} color={c.successText}/> },
                    { label:"À venir",   value:totalCount-doneCount,icon:<Clock size={18} color={c.gold}/> },
                    { label:"Jours restants",value:30-currentDay,  icon:<Calendar size={18} color={c.goldDeep}/> },
                  ].map((stat,i) => (
                    <div key={i} style={{ background:c.surface, border:`1px solid ${c.line}`,
                      borderRadius:12, padding:"12px 16px", textAlign:"center", minWidth:80 }}>
                      <div style={{ display:"flex", justifyContent:"center", marginBottom:6 }}>{stat.icon}</div>
                      <div style={{ fontSize:20, fontWeight:700, color:c.ink }}>{stat.value}</div>
                      <div style={{ fontSize:11, color:c.muted }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 320px", gap:18 }}>
            {/* Weeks */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {loading ? (
                [1,2,3,4].map(i => <Skeleton key={i} height={64} style={{ borderRadius:14 }}/>)
              ) : (
                (onboarding?.weeks||[]).map((week, wi) => {
                  const weekDone  = week.steps.filter(s => s.done).length;
                  const weekTotal = week.steps.length;
                  const isExp     = expandedWeek === wi;
                  return (
                    <div key={wi} style={{ background:c.surface, border:`1px solid ${c.line}`,
                      borderRadius:14, overflow:"hidden", boxShadow:c.shadowCard }}>
                      <button onClick={() => setExpandedWeek(isExp?-1:wi)} style={{
                        width:"100%", display:"flex", alignItems:"center", gap:14,
                        padding:"16px 20px", background:"transparent", border:"none",
                        cursor:"pointer", textAlign:"left" }}>
                        <div style={{ width:42, height:42, borderRadius:10, flexShrink:0,
                          background:weekDone===weekTotal?c.gold:`${c.gold}20`,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {weekDone===weekTotal
                            ? <Award size={20} color={c.onGold}/>
                            : <span style={{ fontSize:14, fontWeight:700, color:c.gold }}>{wi+1}</span>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:600, color:c.ink }}>{week.week} — {week.subtitle}</div>
                          <div style={{ fontSize:12, color:c.muted, marginTop:2 }}>{week.days} · {weekDone}/{weekTotal}</div>
                          <div style={{ height:3, background:`${c.gold}25`, borderRadius:2, marginTop:6, maxWidth:200, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${(weekDone/weekTotal)*100}%`, background:c.gold, borderRadius:2 }}/>
                          </div>
                        </div>
                        <ChevronDown size={18} color={c.muted}
                          style={{ transform:isExp?"rotate(180deg)":"none", transition:"transform .2s" }}/>
                      </button>
                      {isExp && (
                        <div style={{ borderTop:`1px solid ${c.line}`, padding:"12px 20px 16px" }}>
                          {week.steps.map((step, si) => {
                            const ti = typeInfo(step.type);
                            return (
                              <div key={si} style={{ display:"flex", alignItems:"center", gap:12,
                                padding:"10px 0", borderBottom:si<week.steps.length-1?`1px solid ${c.line}`:"none",
                                cursor:"pointer" }} onClick={() => toggleStep(wi, si)}>
                                <div style={{ flexShrink:0 }}>
                                  {step.done
                                    ? <CheckCircle size={20} color={c.gold}/>
                                    : <Circle size={20} color={c.line}/>}
                                </div>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:13.5, color:step.done?c.muted:c.ink,
                                    textDecoration:step.done?"line-through":"none" }}>{step.label}</div>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                                  <span style={{ fontSize:11, color:c.muted }}>{step.day}</span>
                                  <span style={{ background:ti.bg, color:ti.text, borderRadius:5,
                                    padding:"2px 8px", fontSize:11, fontWeight:500 }}>{ti.label}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar droite */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Contacts */}
              <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:14, padding:18, boxShadow:c.shadowCard }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:c.ink, marginBottom:14 }}>Contacts clés</h3>
                {loading ? (
                  [1,2,3,4].map(i => <Skeleton key={i} height={36} style={{ marginBottom:10 }}/>)
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {(onboarding?.contacts||[]).map((contact,i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:"50%", background:c.badge,
                          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:c.goldDeep }}>{contact.avatar}</span>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:c.ink }}>{contact.name}</div>
                          <div style={{ fontSize:11, color:c.muted }}>{contact.role}</div>
                        </div>
                        <span style={{ background:c.badge, color:c.badgeText, borderRadius:5,
                          padding:"2px 7px", fontSize:11 }}>{contact.tag}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ressources */}
              <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:14, padding:18, boxShadow:c.shadowCard }}>
                <h3 style={{ fontSize:14, fontWeight:600, color:c.ink, marginBottom:14 }}>Ressources</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {(onboarding?.resources||[]).map((res,i) => (
                    <button key={i} onClick={() => toast(`Ouverture : ${res.label}`)} style={{
                      display:"flex", alignItems:"center", gap:10,
                      background:c.surfaceAlt, border:`1px solid ${c.line}`,
                      borderRadius:9, padding:"10px 12px", cursor:"pointer", textAlign:"left",
                      transition:"all .2s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor=c.gold}
                      onMouseLeave={e => e.currentTarget.style.borderColor=c.line}>
                      <span style={{ fontSize:18 }}>{res.icon}</span>
                      <span style={{ flex:1, fontSize:12.5, color:c.ink }}>{res.label}</span>
                      <span style={{ fontSize:10, background:c.badge, color:c.badgeText,
                        borderRadius:4, padding:"2px 6px" }}>{res.type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prochain RDV */}
              <div style={{ background:`${c.gold}15`, border:`1px solid ${c.gold}40`, borderRadius:14, padding:18 }}>
                <div style={{ fontSize:12, color:c.goldDeep, fontWeight:600, marginBottom:10,
                  textTransform:"uppercase", letterSpacing:1 }}>Prochain rendez-vous</div>
                <div style={{ fontSize:14, fontWeight:600, color:c.ink, marginBottom:4 }}>Visite des locaux</div>
                <div style={{ fontSize:12.5, color:c.muted, marginBottom:10 }}>Jour 4 · avec Thomas Leroy</div>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:c.gold }}>
                  <Calendar size={13}/> Dans 1 jour
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
