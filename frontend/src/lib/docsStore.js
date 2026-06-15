// Documents générés (par utilisateur). localStorage.
const KEY = "sd-docs-v1";
function get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function getDocsByUser(userId) { return get().filter((d) => d.userId === userId); }
export function addDoc(doc) {
  const entry = { id: Date.now(), status: "pending", ...doc };
  const next = [entry, ...get()]; save(next); return next;
}
