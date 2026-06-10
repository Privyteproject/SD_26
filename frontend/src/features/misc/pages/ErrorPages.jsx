import { useState, useEffect } from "react";
import { Sun, Moon, ArrowLeft, Shield, Home, Lock } from "lucide-react";

// Pages d'erreur — Synapse Digital
// 404 Not Found & 403 Accès refusé — même charte graphique.
// Passer la prop `type="403"` pour afficher la page d'accès refusé.

export default function ErrorPage({ type = "404" }) {
  const [dark, setDark] = useState(false);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = vw < 480;

  const c = dark
    ? {
        bg: "#140D06", surface: "#241A10", ink: "#F1E7D6",
        muted: "#AE9778", line: "#3A2C1C",
        gold: "#D7A954", goldDeep: "#E7C57F", onGold: "#191108",
        glow: "rgba(215,169,84,.10)", shadow: "0 30px 70px -30px rgba(0,0,0,.8)",
        danger: "#3A1010", dangerText: "#E07A7A",
      }
    : {
        bg: "#EFE4CF", surface: "#FBF6EC", ink: "#2D2114",
        muted: "#6E5C46", line: "#E6D8BF",
        gold: "#B8893E", goldDeep: "#946B2A", onGold: "#FFFFFF",
        glow: "rgba(184,137,62,.16)", shadow: "0 30px 70px -28px rgba(120,86,30,.5)",
        danger: "#FDE8E8", dangerText: "#C62828",
      };

  const Mark = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
      <circle cx="17" cy="17" r="4.2" fill={c.gold} />
      <circle cx="7" cy="8" r="2.4" fill={c.goldDeep} />
      <circle cx="27" cy="9" r="2.4" fill={c.gold} />
      <circle cx="8" cy="26" r="2.4" fill={c.gold} />
      <circle cx="26" cy="26" r="2.4" fill={c.goldDeep} />
      <path d="M17 17 L7 8 M17 17 L27 9 M17 17 L8 26 M17 17 L26 26"
        stroke={c.gold} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );

  const is404 = type === "404";

  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: c.bg, color: c.ink, position: "relative",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      padding: 24, transition: "background .4s",
    }}>
      {/* Ambiance */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `radial-gradient(${c.glow}, transparent 60%)`,
        backgroundSize: "680px 680px", backgroundPosition: "center -80px",
        backgroundRepeat: "no-repeat",
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `radial-gradient(${dark ? "rgba(215,169,84,.04)" : "rgba(120,86,30,.04)"} 1px, transparent 1px)`,
        backgroundSize: "26px 26px",
      }} />

      {/* Theme toggle */}
      <button onClick={() => setDark(!dark)} aria-label="Basculer le thème"
        style={{
          position: "absolute", top: isMobile ? 14 : 24, right: isMobile ? 14 : 24,
          width: 38, height: 38, borderRadius: 9,
          border: `1px solid ${c.line}`, background: c.surface,
          color: c.ink, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        {dark ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Card */}
      <div style={{
        background: c.surface, border: `1px solid ${c.line}`,
        borderRadius: 22, padding: isMobile ? "32px 22px" : "48px 52px",
        maxWidth: 460, width: "100%", textAlign: "center",
        boxShadow: c.shadow, position: "relative",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 36 }}>
          <Mark />
          <span style={{ lineHeight: 1 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: c.ink }}>Synapse</span>
            <span style={{ display: "block", fontSize: 8, letterSpacing: 3, color: c.goldDeep, fontWeight: 600, marginTop: 2 }}>DIGITAL</span>
          </span>
        </div>

        {/* Illustration */}
        <div style={{ position: "relative", display: "inline-flex", marginBottom: 28 }}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: is404 ? `${c.gold}15` : c.danger,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {is404
              ? <span style={{ fontSize: 40, lineHeight: 1 }}>🔍</span>
              : <Lock size={44} color={c.dangerText} strokeWidth={1.5} />
            }
          </div>
          {/* Floating badge */}
          <div style={{
            position: "absolute", top: -4, right: -4,
            background: is404 ? c.gold : c.dangerText,
            color: is404 ? c.onGold : "#FFFFFF",
            borderRadius: 20, padding: "3px 10px",
            fontSize: 12, fontWeight: 800, boxShadow: c.shadow,
            border: `2px solid ${c.surface}`,
          }}>
            {is404 ? "404" : "403"}
          </div>
        </div>

        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: c.ink, marginBottom: 10 }}>
          {is404 ? "Page introuvable" : "Accès refusé"}
        </h1>

        <p style={{ fontSize: 14, color: c.muted, lineHeight: 1.65, marginBottom: 32, maxWidth: 340, margin: "0 auto 32px" }}>
          {is404
            ? "La page que vous recherchez n'existe pas ou a été déplacée. Vérifiez l'adresse ou retournez à l'accueil."
            : "Vous n'avez pas les autorisations nécessaires pour accéder à cette ressource. Si vous pensez qu'il s'agit d'une erreur, contactez votre responsable RH ou l'administrateur."
          }
        </p>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button style={{
            width: "100%", height: 48, borderRadius: 10,
            background: c.gold, color: c.onGold,
            border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "opacity .2s",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <Home size={17} /> Retour à l'accueil
          </button>

          <button style={{
            width: "100%", height: 44, borderRadius: 10,
            background: "transparent", color: c.muted,
            border: `1px solid ${c.line}`, cursor: "pointer",
            fontSize: 14, fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <ArrowLeft size={16} /> Page précédente
          </button>

          {!is404 && (
            <button style={{
              width: "100%", height: 44, borderRadius: 10,
              background: "transparent", color: c.goldDeep,
              border: `1px solid ${c.gold}50`, cursor: "pointer",
              fontSize: 14, fontWeight: 500,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <Shield size={16} /> Contacter l'administrateur
            </button>
          )}
        </div>

        {/* Code d'erreur discret */}
        <div style={{ marginTop: 28, fontSize: 11, color: `${c.muted}60`, fontFamily: "ui-monospace, monospace" }}>
          {is404 ? "ERR_ROUTE_NOT_FOUND" : "ERR_UNAUTHORIZED_ACCESS"} · Synapse IA RH v1.0
        </div>
      </div>
    </div>
  );
}
