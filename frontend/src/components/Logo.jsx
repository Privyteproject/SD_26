// Marque Synapse Digital — nouveau logo officiel (mark doré, fond transparent).
// layout: "mark" (icône) | "full"/"stack" (mise en avant). `animated` = apparition en fondu/zoom.
// Variante crème disponible (/brand/synapse-mark-cream.png) pour les fonds sombres.
const MARK = "/brand/synapse-mark.png";

export default function Logo({ size = 32, layout = "mark", animated = false }) {
  const isFull = layout === "full" || layout === "row" || layout === "stack";
  const src = MARK;  // un seul mark officiel (le nouveau jeu ne contient pas de lockup texte)
  const height = isFull ? size * 1.3 : size * 1.16;
  return (
    <img
      src={src}
      alt="Synapse Digital"
      className={animated ? "ds-logo-pop" : undefined}
      style={{ height, width: "auto", display: "block", userSelect: "none" }}
      draggable="false"
    />
  );
}
