// Demandes partagées (workflow collaborateur -> validation RH/Manager). localStorage.
const KEY = "sd-requests-v1";
function get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function getAllRequests() { return get(); }
export function getRequestsByUser(userId) { return get().filter((r) => r.userId === userId); }
export function addRequest(req) {
  const entry = { id: Date.now(), status: "pending", ...req };
  const next = [entry, ...get()]; save(next); return next;
}
export function setRequestStatus(id, status) {
  const next = get().map((r) => (r.id === id ? { ...r, status } : r)); save(next); return next;
}
