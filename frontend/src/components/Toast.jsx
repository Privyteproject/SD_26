import { useEffect, useState } from "react";

// Écoute les événements émis par le client API et affiche un message transitoire.
export default function Toast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let timer;
    const show = (text) => { setMsg(text); clearTimeout(timer); timer = setTimeout(() => setMsg(null), 3500); };
    const onError = (e) => show((e.detail && e.detail.message) || "Une erreur est survenue.");
    const onExpired = () => show("Session expirée, veuillez vous reconnecter.");
    window.addEventListener("api:error", onError);
    window.addEventListener("auth:expired", onExpired);
    return () => { window.removeEventListener("api:error", onError); window.removeEventListener("auth:expired", onExpired); clearTimeout(timer); };
  }, []);
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
      background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)",
      borderLeft: "3px solid var(--danger)", borderRadius: 10, padding: "12px 16px",
      boxShadow: "var(--shadow)", fontSize: 13.5, maxWidth: 360 }}>
      {msg}
    </div>
  );
}
