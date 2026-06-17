import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";

/**
 * Menu contextuel réutilisable et déclaratif.
 *
 * Usage : <ContextMenu actions={[ {label, icon, onClick, danger?, disabled?}, ... ]} />
 * Les entrées falsy (null/false/undefined) sont ignorées — l'appelant peut donc écrire
 * des actions conditionnelles : `cond && { label, icon, onClick }`. Cela permet d'adapter
 * les actions au contexte (type d'élément, statut, rôle) sans logique dans le composant.
 */
export default function ContextMenu({ actions = [], size = 34, align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const items = actions.filter(Boolean);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  if (!items.length) return null;

  const run = (a) => { if (a.disabled) return; setOpen(false); a.onClick?.(); };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="actions"
        style={{ width: size, height: size, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div style={{ position: "absolute", top: size + 4, [align]: 0, minWidth: 188, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", zIndex: 50, overflow: "hidden", padding: 4 }}>
          {items.map((a, i) => {
            const Icon = a.icon;
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); run(a); }}
                disabled={a.disabled}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 7, border: "none", background: "transparent", cursor: a.disabled ? "default" : "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13.5, color: a.disabled ? "var(--muted)" : (a.danger ? "var(--danger)" : "var(--ink)"), opacity: a.disabled ? 0.5 : 1 }}
              >
                {Icon && <Icon size={15} style={{ flexShrink: 0 }} />} {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
