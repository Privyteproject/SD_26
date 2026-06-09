import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun, Moon, User, Lock, Bell, Shield, Eye, EyeOff,
  Check, Edit3, Save, X, LogOut, Menu, Settings,
  LayoutDashboard, MessageSquare, FileText, Calendar,
  Key, Smartphone, AlertCircle, CheckCircle, Camera,
  Mail, Phone, Briefcase, MapPin, Globe, Loader
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useApi, API } from "../auth/useApi";
import { useSecurity } from "../auth/useSecurity";
import { getColors } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { Skeleton, SkeletonStyles } from "../components/Skeleton";
import toast, { Toaster } from "react-hot-toast";

export default function ProfilUtilisateur({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [activeTab,    setActiveTab]    = useState("profil");
  const [editMode,     setEditMode]     = useState(false);
  const [showPwd,      setShowPwd]      = useState({ current:false, new:false, confirm:false });
  const [mfaEnabled,   setMfaEnabled]   = useState(false);
  const [notifPrefs,   setNotifPrefs]   = useState({ email:true, push:false, rh:true, alertes:true, onboarding:false });
  const [profilData,   setProfilData]   = useState(null);
  const [sessions,     setSessions]     = useState(null);
  const [loadingProfil,setLoadingProfil]= useState(true);
  const [saving,       setSaving]       = useState(false);
  const [pwdFields,    setPwdFields]    = useState({ current:"", new:"", confirm:"" });
  const [pwdErrors,    setPwdErrors]    = useState({});
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate  = useNavigate();
  const { user } = useAuth();
  const api       = useApi();
  const { validators, validateForm } = useSecurity();
  const c = getColors(dark_);
  const isMobile  = vw < 768;

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadProfil = useCallback(async () => {
    setLoadingProfil(true);
    const [resP, resS] = await Promise.all([
      api.get(API.PROFIL),
      api.get(API.PROFIL_SESSIONS),
    ]);
    setProfilData(resP.ok ? resP.data : {
      prenom:    user?.name?.split(" ")[0] || "Arush",
      nom:       user?.name?.split(" ")[1] || "Ramisami",
      email:     user?.email || "a.ramisami@synapse.ma",
      telephone: "+212 6 00 00 00 00",
      poste:     "Développeur Frontend",
      departement:"Tech & Produit",
      localisation:"Casablanca, Maroc",
      embauche:  "01/09/2023",
    });
    setSessions(resS.ok ? resS.data : [
      { device:"Chrome · macOS Sonoma",  location:"Casablanca, MA", time:"Actif maintenant", current:true  },
      { device:"Safari · iPhone 15",     location:"Casablanca, MA", time:"Hier, 19:42",       current:false },
      { device:"Firefox · Windows 11",   location:"Rabat, MA",      time:"29/05/2026, 08:15", current:false },
    ]);
    setLoadingProfil(false);
  }, [user]);

  useEffect(() => { loadProfil(); }, [loadProfil]);

  const handleSaveProfil = async () => {
    setSaving(true);
    const res = await api.put(API.PROFIL, profilData);
    setSaving(false);
    setEditMode(false);
    if (res.ok) toast.success("Profil sauvegardé !");
    else toast.success("Profil sauvegardé (mode démo)");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const { valid, errors } = validateForm({
      password: [pwdFields.new, [validators.password]],
      confirm:  [pwdFields.confirm, [(v) => v !== pwdFields.new ? "Les mots de passe ne correspondent pas." : null]],
      current:  [pwdFields.current, [(v) => v ? null : "Mot de passe actuel requis."]],
    });
    if (!valid) { setPwdErrors(errors); return; }
    setPwdErrors({});
    const res = await api.patch(API.PROFIL_PASSWORD, { current: pwdFields.current, newPassword: pwdFields.new });
    if (res.ok) { toast.success("Mot de passe modifié !"); setPwdFields({ current:"", new:"", confirm:"" }); }
    else toast.success("Mot de passe modifié (mode démo)");
  };

  const handleRevokeSession = async (idx) => {
    const newSessions = sessions.filter((_, i) => i !== idx);
    setSessions(newSessions);
    toast.success("Session révoquée");
  };

  const handleSaveNotifs = async () => {
    const res = await api.patch(API.PROFIL_NOTIFS, notifPrefs);
    if (res.ok) toast.success("Préférences sauvegardées !");
    else toast.success("Préférences sauvegardées (mode démo)");
  };

  const pwdStrength = (pwd) => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return [{label:"",color:c.line},{label:"Faible",color:c.dangerText},{label:"Moyen",color:"#E7A020"},{label:"Fort",color:"#5BA85A"},{label:"Très fort",color:"#2E7D32"}][s];
  };
  const ps = pwdStrength(pwdFields.new);

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)} style={{ width:44, height:24, borderRadius:12, padding:2,
      background:value?c.gold:c.line, border:"none", cursor:"pointer", transition:"background .25s",
      display:"flex", alignItems:"center" }}>
      <div style={{ width:20, height:20, borderRadius:"50%", background:value?c.onGold:c.surface,
        transform:value?"translateX(20px)":"translateX(0)", transition:"transform .25s" }}/>
    </button>
  );

  const PERMS = [
    { label:"Consulter ses propres données RH",      granted:true  },
    { label:"Utiliser l'assistant IA RH",            granted:true  },
    { label:"Générer des documents personnels",      granted:true  },
    { label:"Accéder aux données des autres",        granted:false },
    { label:"Consulter les tableaux de bord RH",     granted:false },
    { label:"Accéder au module d'administration",    granted:false },
  ];

  const tabs = [
    { key:"profil",        label:"Mon profil",     icon:<User size={15}/> },
    { key:"securite",      label:"Sécurité",       icon:<Shield size={15}/> },
    { key:"notifications", label:"Notifications",  icon:<Bell size={15}/> },
    { key:"acces",         label:"Accès & rôle",   icon:<Key size={15}/> },
  ];

  const fieldList = profilData ? [
    { label:"Prénom",               value:"prenom",       icon:<User size={14}/> },
    { label:"Nom",                  value:"nom",          icon:<User size={14}/> },
    { label:"Email professionnel",  value:"email",        icon:<Mail size={14}/> },
    { label:"Téléphone",            value:"telephone",    icon:<Phone size={14}/> },
    { label:"Poste",                value:"poste",        icon:<Briefcase size={14}/> },
    { label:"Département",          value:"departement",  icon:<Globe size={14}/> },
    { label:"Localisation",         value:"localisation", icon:<MapPin size={14}/> },
    { label:"Date d'embauche",      value:"embauche",     icon:<Calendar size={14}/> },
  ] : [];

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
        userSubtitle="Collaborateur"
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)}/>

      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <header style={{ height:58, background:c.surface, borderBottom:`1px solid ${c.line}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 20px", position:"sticky", top:0, zIndex:30 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)}
              style={{ background:"none", border:"none", cursor:"pointer", color:c.ink, display:"flex" }}><Menu size={22}/></button>}
            <div style={{ fontSize:15, fontWeight:600, color:c.ink }}>Mon profil & paramètres</div>
          </div>
          <button onClick={() => setDark(!dark_)}
            style={{ width:36, height:36, borderRadius:8, border:`1px solid ${c.line}`,
              background:c.surface, color:c.ink, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
            {dark_?<Moon size={17}/>:<Sun size={17}/>}
          </button>
        </header>

        <main style={{ flex:1, padding:isMobile?14:24, overflowY:"auto" }}>
          {/* Hero profil */}
          <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16,
            padding:"24px 24px 20px", marginBottom:20, boxShadow:c.shadowCard,
            display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
            <div style={{ position:"relative" }}>
              <div style={{ width:70, height:70, borderRadius:"50%",
                background:`linear-gradient(135deg,${c.gold},${c.goldDeep})`,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ color:c.onGold, fontWeight:700, fontSize:24 }}>{user?.initials||"?"}</span>
              </div>
              <button style={{ position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:"50%",
                background:c.gold, border:`2px solid ${c.surface}`,
                display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
                onClick={() => toast("Upload photo disponible après connexion backend")}>
                <Camera size={11} color={c.onGold}/>
              </button>
            </div>
            <div style={{ flex:1 }}>
              {loadingProfil ? <Skeleton height={18} width={160}/> :
                <div style={{ fontSize:18, fontWeight:700, color:c.ink }}>{user?.name||"—"}</div>}
              <div style={{ fontSize:13, color:c.muted, marginTop:2 }}>
                {profilData?.poste || "—"} · {profilData?.departement || "—"}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                <span style={{ background:c.badge, color:c.badgeText, borderRadius:20, padding:"3px 10px", fontSize:12 }}>
                  {user?.role ? user.role.charAt(0).toUpperCase()+user.role.slice(1) : "Collaborateur"}
                </span>
                <span style={{ background:c.success, color:c.successText, borderRadius:20, padding:"3px 10px", fontSize:12 }}>✓ Email vérifié</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:2, marginBottom:20, background:c.surface,
            padding:4, borderRadius:12, border:`1px solid ${c.line}`, flexWrap:"wrap" }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                flex:isMobile?"none":1, padding:"8px 14px", borderRadius:8,
                border:"none", cursor:"pointer", fontSize:13,
                fontWeight:activeTab===tab.key?600:400,
                background:activeTab===tab.key?c.gold:"transparent",
                color:activeTab===tab.key?c.onGold:c.muted,
                transition:"all .2s", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Tab Profil */}
          {activeTab === "profil" && (
            <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16,
              padding:24, boxShadow:c.shadowCard, maxWidth:620 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <h3 style={{ fontSize:15, fontWeight:600, color:c.ink }}>Informations personnelles</h3>
                {!editMode
                  ? <button onClick={() => setEditMode(true)} style={{ display:"flex", alignItems:"center", gap:6,
                      background:"transparent", border:`1px solid ${c.line}`, borderRadius:8,
                      color:c.muted, padding:"6px 12px", cursor:"pointer", fontSize:13 }}>
                      <Edit3 size={14}/> Modifier
                    </button>
                  : <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => setEditMode(false)} style={{ display:"flex", alignItems:"center", gap:6,
                        background:"transparent", border:`1px solid ${c.line}`, borderRadius:8,
                        color:c.muted, padding:"6px 12px", cursor:"pointer", fontSize:13 }}><X size={14}/></button>
                      <button onClick={handleSaveProfil} disabled={saving} style={{ display:"flex", alignItems:"center", gap:6,
                        background:c.gold, border:"none", borderRadius:8, color:c.onGold,
                        padding:"6px 14px", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                        {saving?<Loader size={14} style={{ animation:"spin 1s linear infinite"}}/>:<Save size={14}/>} Sauvegarder
                      </button>
                    </div>
                }
              </div>
              {loadingProfil ? (
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                  {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} height={46} style={{ borderRadius:9 }}/>)}
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
                  {fieldList.map((field) => (
                    <div key={field.value}>
                      <label style={{ fontSize:12, fontWeight:500, color:c.muted, display:"block", marginBottom:5 }}>{field.label}</label>
                      <div style={{ display:"flex", alignItems:"center", gap:8,
                        background:editMode?c.inputBg:"transparent",
                        border:`1px solid ${editMode?c.line:c.line+"60"}`,
                        borderRadius:9, padding:"9px 12px" }}>
                        <span style={{ color:c.muted, flexShrink:0 }}>{field.icon}</span>
                        {editMode
                          ? <input value={profilData[field.value]||""} onChange={e => setProfilData(p => ({...p,[field.value]:e.target.value}))}
                              style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:13.5, color:c.ink, fontFamily:"inherit" }}/>
                          : <span style={{ fontSize:13.5, color:c.ink }}>{profilData[field.value]||"—"}</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Sécurité */}
          {activeTab === "securite" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:560 }}>
              {/* Mot de passe */}
              <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:22, boxShadow:c.shadowCard }}>
                <h3 style={{ fontSize:15, fontWeight:600, color:c.ink, marginBottom:18 }}>Changer le mot de passe</h3>
                <form onSubmit={handleChangePassword} style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {[
                    { label:"Mot de passe actuel",              key:"current" },
                    { label:"Nouveau mot de passe",             key:"new"     },
                    { label:"Confirmer le nouveau mot de passe",key:"confirm" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize:12, color:c.muted, display:"block", marginBottom:5 }}>{f.label}</label>
                      <div style={{ display:"flex", alignItems:"center", gap:8, background:c.inputBg,
                        border:`1px solid ${pwdErrors[f.key]?c.dangerText:c.line}`, borderRadius:9, padding:"9px 12px" }}>
                        <Lock size={14} color={c.muted}/>
                        <input type={showPwd[f.key]?"text":"password"} placeholder="••••••••"
                          value={pwdFields[f.key]} onChange={e => setPwdFields(p => ({...p,[f.key]:e.target.value}))}
                          style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:13.5, color:c.ink, fontFamily:"inherit" }}/>
                        <button type="button" onClick={() => setShowPwd(p => ({...p,[f.key]:!p[f.key]}))}
                          style={{ background:"none", border:"none", cursor:"pointer", color:c.muted, display:"flex" }}>
                          {showPwd[f.key]?<EyeOff size={15}/>:<Eye size={15}/>}
                        </button>
                      </div>
                      {f.key==="new" && pwdFields.new && (
                        <div style={{ marginTop:6 }}>
                          <div style={{ height:3, background:c.line, borderRadius:2, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${(["Faible","Moyen","Fort","Très fort"].indexOf(ps.label)+1)/4*100}%`,
                              background:ps.color, borderRadius:2, transition:"all .3s" }}/>
                          </div>
                          <div style={{ fontSize:11, color:ps.color, marginTop:3 }}>{ps.label}</div>
                        </div>
                      )}
                      {pwdErrors[f.key] && <div style={{ fontSize:12, color:c.dangerText, marginTop:4 }}>{pwdErrors[f.key]}</div>}
                    </div>
                  ))}
                  <button type="submit" style={{ marginTop:4, background:c.gold, color:c.onGold, border:"none",
                    borderRadius:9, padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:600 }}>
                    Mettre à jour le mot de passe
                  </button>
                </form>
              </div>

              {/* MFA */}
              <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:22, boxShadow:c.shadowCard }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <h3 style={{ fontSize:15, fontWeight:600, color:c.ink, marginBottom:4 }}>Double authentification (MFA)</h3>
                    <div style={{ fontSize:13, color:c.muted }}>Renforcez la sécurité avec une 2ème vérification.</div>
                  </div>
                  <Toggle value={mfaEnabled} onChange={v => { setMfaEnabled(v); toast.success(v?"MFA activé !":"MFA désactivé"); }}/>
                </div>
                {mfaEnabled && (
                  <div style={{ marginTop:14, background:c.success, borderRadius:9, padding:"12px 14px",
                    display:"flex", gap:8, alignItems:"center" }}>
                    <CheckCircle size={16} color={c.successText}/>
                    <span style={{ fontSize:13, color:c.successText }}>MFA activé. Configurez votre application d'authentification (Keycloak TOTP).</span>
                  </div>
                )}
              </div>

              {/* Sessions */}
              <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16, padding:22, boxShadow:c.shadowCard }}>
                <h3 style={{ fontSize:15, fontWeight:600, color:c.ink, marginBottom:16 }}>Sessions actives</h3>
                {loadingProfil ? [1,2,3].map(i => <Skeleton key={i} height={54} style={{ marginBottom:10, borderRadius:10 }}/>) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {(sessions||[]).map((s,i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                        background:c.surfaceAlt, borderRadius:10, padding:"12px 14px",
                        border:`1px solid ${s.current?c.gold+"60":c.line}` }}>
                        <Smartphone size={18} color={s.current?c.gold:c.muted}/>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:c.ink }}>{s.device}</div>
                          <div style={{ fontSize:11.5, color:c.muted }}>{s.location} · {s.time}</div>
                        </div>
                        {s.current
                          ? <span style={{ background:c.success, color:c.successText, borderRadius:20, padding:"3px 9px", fontSize:11, fontWeight:600 }}>Actuelle</span>
                          : <button onClick={() => handleRevokeSession(i)}
                              style={{ background:"transparent", border:`1px solid ${c.dangerText}40`,
                                color:c.dangerText, borderRadius:7, padding:"4px 10px", fontSize:12, cursor:"pointer" }}>Révoquer</button>
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Notifications */}
          {activeTab === "notifications" && (
            <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16,
              padding:24, boxShadow:c.shadowCard, maxWidth:520 }}>
              <h3 style={{ fontSize:15, fontWeight:600, color:c.ink, marginBottom:20 }}>Préférences de notifications</h3>
              {[
                { key:"email",      label:"Notifications par email",   desc:"Recevoir les alertes RH par email"        },
                { key:"push",       label:"Notifications push",         desc:"Notifications dans l'application"         },
                { key:"rh",         label:"Actualités RH",              desc:"Nouvelles politiques, annonces internes"  },
                { key:"alertes",    label:"Alertes importantes",        desc:"Congés, entretiens, documents à signer"   },
                { key:"onboarding", label:"Rappels onboarding",         desc:"Étapes à compléter, rendez-vous"          },
              ].map((n, i, arr) => (
                <div key={n.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"16px 0", borderBottom:i<arr.length-1?`1px solid ${c.line}`:"none" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:500, color:c.ink }}>{n.label}</div>
                    <div style={{ fontSize:12.5, color:c.muted, marginTop:2 }}>{n.desc}</div>
                  </div>
                  <Toggle value={notifPrefs[n.key]} onChange={v => setNotifPrefs(p => ({...p,[n.key]:v}))}/>
                </div>
              ))}
              <button onClick={handleSaveNotifs} style={{ marginTop:20, background:c.gold, color:c.onGold,
                border:"none", borderRadius:9, padding:"11px 0", width:"100%", cursor:"pointer", fontSize:14, fontWeight:600 }}>
                Sauvegarder les préférences
              </button>
            </div>
          )}

          {/* Tab Accès & Rôle */}
          {activeTab === "acces" && (
            <div style={{ background:c.surface, border:`1px solid ${c.line}`, borderRadius:16,
              padding:24, boxShadow:c.shadowCard, maxWidth:520 }}>
              <div style={{ marginBottom:20 }}>
                <h3 style={{ fontSize:15, fontWeight:600, color:c.ink, marginBottom:12 }}>Mon rôle</h3>
                <div style={{ display:"flex", alignItems:"center", gap:12, background:c.badge, borderRadius:10, padding:"14px 16px" }}>
                  <Shield size={20} color={c.gold}/>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:c.ink }}>
                      {user?.role ? user.role.charAt(0).toUpperCase()+user.role.slice(1) : "Collaborateur"}
                    </div>
                    <div style={{ fontSize:12, color:c.muted }}>Données personnelles uniquement</div>
                  </div>
                </div>
              </div>
              <h3 style={{ fontSize:14, fontWeight:600, color:c.ink, marginBottom:14 }}>Mes permissions</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                {PERMS.map((p, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                    padding:"10px 0", borderBottom:i<PERMS.length-1?`1px solid ${c.line}`:"none" }}>
                    <div style={{ width:20, height:20, borderRadius:"50%",
                      background:p.granted?c.success:c.danger,
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {p.granted
                        ? <Check size={12} color={c.successText}/>
                        : <X size={12} color={c.dangerText}/>}
                    </div>
                    <span style={{ fontSize:13.5, color:p.granted?c.ink:c.muted }}>{p.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:18, background:c.warn, borderRadius:9, padding:"12px 14px",
                display:"flex", gap:8 }}>
                <AlertCircle size={16} color={c.warnText} style={{ flexShrink:0, marginTop:1 }}/>
                <span style={{ fontSize:12.5, color:c.warnText }}>Pour modifier vos droits d'accès, contactez votre responsable RH ou l'administrateur.</span>
              </div>
            </div>
          )}
        </main>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
