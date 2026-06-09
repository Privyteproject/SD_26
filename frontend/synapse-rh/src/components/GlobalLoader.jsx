/**
 * GlobalLoader — barre de progression en haut de page lors des navigations
 * NetworkBanner — bandeau rouge si le backend est hors ligne
 */
import { useState, useEffect, createContext, useContext } from "react";

// ── Context ───────────────────────────────────────────────────────────────────
const LoaderCtx = createContext({ show: () => {}, hide: () => {} });
export const useLoader = () => useContext(LoaderCtx);

// ── Provider ──────────────────────────────────────────────────────────────────
export function GlobalLoaderProvider({ children }) {
  const [progress,  setProgress]  = useState(0);
  const [visible,   setVisible]   = useState(false);
  const [offline,   setOffline]   = useState(false);
  const [demoMode,  setDemoMode]  = useState(false);

  // Détecter connexion réseau
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online",  goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online",  goOnline);
    };
  }, []);

  function show() {
    setProgress(20);
    setVisible(true);
    const t1 = setTimeout(() => setProgress(60), 200);
    const t2 = setTimeout(() => setProgress(80), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }

  function hide() {
    setProgress(100);
    setTimeout(() => { setVisible(false); setProgress(0); }, 300);
  }

  function markDemoMode(val) { setDemoMode(val); }

  return (
    <LoaderCtx.Provider value={{ show, hide, markDemoMode }}>
      {/* Barre de progression */}
      {visible && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0,
          height: 3, zIndex: 9999, pointerEvents: "none",
        }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #B8893E, #D7A954)",
            transition: "width .3s ease",
            boxShadow: "0 0 10px rgba(215,169,84,.6)",
          }} />
        </div>
      )}

      {/* Bandeau hors ligne */}
      {offline && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9998,
          background: "#C62828", color: "#FFFFFF",
          padding: "8px 16px", textAlign: "center",
          fontSize: 13, fontWeight: 500,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}>
          ⚠️ Connexion réseau perdue. Vérifiez votre connexion internet.
        </div>
      )}

      {/* Bandeau mode démo */}
      {demoMode && !offline && (
        <div style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 9997,
          background: "#2A1E0E", color: "#E7C57F",
          border: "1px solid #D7A954",
          borderRadius: 10, padding: "10px 16px",
          fontSize: 12.5, fontWeight: 500,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 20px rgba(0,0,0,.4)",
          maxWidth: 320,
        }}>
          <span style={{ fontSize: 16 }}>ℹ️</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Mode démo actif</div>
            <div style={{ fontSize: 11.5, opacity: .8 }}>
              Les données affichées sont des exemples. Connectez le backend pour les données réelles.
            </div>
          </div>
        </div>
      )}

      {children}
    </LoaderCtx.Provider>
  );
}
