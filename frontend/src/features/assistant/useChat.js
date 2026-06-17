import { useState, useEffect, useCallback, useRef } from "react";
import {
  sendChatMessage, getChatSessions, getChatSessionMessages, deleteChatSession, ApiError,
} from "../../lib/api";

const STORE_KEY = "chat_active_session";

/**
 * Gère l'historique de chat persistant : sessions, session active, messages.
 * La session active est mémorisée dans sessionStorage (pas localStorage) et
 * rechargée depuis l'API au retour sur la page. Si elle n'existe plus → conversation vide.
 */
export function useChat(audience = "collaborateur") {
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState(() => sessionStorage.getItem(STORE_KEY) || null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // envoi en cours
  const didInit = useRef(false);

  const persist = (id) => {
    if (id) sessionStorage.setItem(STORE_KEY, id);
    else sessionStorage.removeItem(STORE_KEY);
  };

  const loadSessions = useCallback(async () => {
    try { const res = await getChatSessions(); return (res && res.data) || []; }
    catch { return []; }
  }, []);

  const refreshSessions = useCallback(async () => {
    const list = await loadSessions();
    setSessions(list);
    return list;
  }, [loadSessions]);

  const openSession = useCallback(async (id) => {
    setActiveSessionId(id); persist(id);
    try {
      const res = await getChatSessionMessages(id);
      setMessages(((res && res.data) || []).map((m) => ({ role: m.role, content: m.content, meta: { mode: m.mode } })));
    } catch {
      // Session supprimée/inaccessible → on repart sur une conversation vide.
      setActiveSessionId(null); persist(null); setMessages([]);
    }
  }, []);

  const newSession = useCallback(() => {
    setActiveSessionId(null); persist(null); setMessages([]);
  }, []);

  const deleteSession = useCallback(async (id) => {
    try { await deleteChatSession(id); } catch { /* ignore */ }
    if (id === activeSessionId) newSession();
    refreshSessions();
  }, [activeSessionId, newSession, refreshSessions]);

  const sendMessage = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || isLoading) return;
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setIsLoading(true);
    try {
      const res = await sendChatMessage(msg, { history, sessionId: activeSessionId, audience });
      const d = (res && res.data) || {};
      const sid = d.meta?.session_id;
      if (sid && sid !== activeSessionId) { setActiveSessionId(sid); persist(sid); }
      setMessages((prev) => [...prev, {
        role: "assistant", content: d.reply || "(réponse vide)", meta: d.meta, model: d.model, degraded: d.degraded,
      }]);
      refreshSessions();
    } catch (err) {
      const m = err instanceof ApiError && err.status === 429
        ? "Trop de requêtes — patientez une minute avant de réessayer."
        : `Service IA indisponible${err?.message ? ` : ${err.message}` : ""}.`;
      setMessages((prev) => [...prev, { role: "assistant", content: m, error: true }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, activeSessionId, audience, refreshSessions]);

  // Init : charge les sessions et recharge la session active mémorisée (si encore valide).
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      setSessionsLoading(true);
      const list = await refreshSessions();
      setSessionsLoading(false);
      const stored = sessionStorage.getItem(STORE_KEY);
      if (stored && list.some((s) => s.id === stored)) openSession(stored);
      else if (stored) { persist(null); setActiveSessionId(null); }
    })();
  }, [refreshSessions, openSession]);

  return { sessions, sessionsLoading, activeSessionId, messages, isLoading,
           sendMessage, newSession, deleteSession, openSession };
}
