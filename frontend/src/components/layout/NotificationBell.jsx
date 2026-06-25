import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ShieldAlert, Calendar, Info, LifeBuoy, CheckCheck } from "lucide-react";
import { useI18n } from "../../app/providers/I18nProvider";
import { useSession } from "../../app/providers/SessionProvider";
import { RH_SPACE_ROLES } from "../../lib/constants";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../lib/api";

const ICON = { securite: ShieldAlert, absence: Calendar, escalade: LifeBuoy };
const COLOR = { high: "var(--danger)", mid: "var(--gold-deep)", low: "var(--muted)" };

// Source à ouvrir au clic, selon la catégorie de la notification (espace RH).
const ROUTE_BY_CAT = {
  risque_eleve: "/rh/desengagement",
  parcours_retard: "/rh/onboarding",
  escalade: "/rh/alertes",
  securite: "/rh/alertes",
  acces_refuse: "/rh/alertes",
  acces_refuse_repete: "/rh/alertes",
  fuite_donnees: "/rh/alertes",
  absence: "/rh/demandes",
};

function ago(iso, lang) {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  const fr = lang === "fr";
  if (d < 60) return fr ? "à l'instant" : "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min`;
  if (d < 86400) return fr ? `il y a ${Math.floor(d / 3600)} h` : `${Math.floor(d / 3600)}h`;
  return new Date(iso).toLocaleDateString(fr ? "fr-FR" : "en-GB");
}

// Cloche de notifications : polling 30 s, badge non-lues, menu déroulant.
export default function NotificationBell() {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const navigate = useNavigate();
  const isElevated = [...RH_SPACE_ROLES].includes(role);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await getNotifications();
      setItems((res && res.data) || []);
      setUnread((res && res.meta && res.meta.unread) || 0);
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);  // polling toutes les 30 s
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Clic sur une notification : marque comme lue, ferme le menu, redirige vers la source.
  const onOpen = async (n) => {
    if (!n.lue) { try { await markNotificationRead(n.id); } catch { /* ignore */ } }
    setOpen(false);
    const target = isElevated ? (ROUTE_BY_CAT[n.categorie] || "/rh/alertes")
                              : (n.categorie === "absence" ? "/app/demandes" : "/app");
    navigate(target);
    load();
  };

  const clearAll = async () => {
    try { await markAllNotificationsRead(); load(); } catch { /* ignore */ }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button aria-label="Notifications" onClick={() => setOpen((v) => !v)} style={{ position: "relative", width: 38, height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Bell size={18} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: "var(--danger)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: 46, width: 320, maxHeight: 420, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow)", zIndex: 40, padding: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px" }}>
            <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>{t("notif.title")}</span>
            {items.length > 0 && (
              <button type="button" onClick={clearAll} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--gold-deep)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                <CheckCheck size={14} /> {t("notif.clearAll")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>{t("notif.empty")}</div>
          ) : items.map((n) => {
            const Icon = ICON[n.categorie] || Info;
            return (
              <button key={n.id} onClick={() => onOpen(n)} style={{ width: "100%", display: "flex", gap: 9, padding: "9px 10px", borderRadius: 8, border: "none", background: n.lue ? "transparent" : "var(--gold-tint)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <Icon size={16} style={{ color: COLOR[n.gravite] || "var(--muted)", flexShrink: 0, marginTop: 2 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, color: "var(--ink)", lineHeight: 1.35 }}>{n.message}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{ago(n.date_creation, lang)}</span>
                </span>
                {!n.lue && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", flexShrink: 0, marginTop: 5 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
