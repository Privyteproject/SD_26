// Marque Synapse Digital — images officielles (empreinte cuivre, fond transparent).
// layout: "mark" (icône seule) | "full" (lockup icône + texte). `animated` = apparition en fondu/zoom.
const MARK = "/brand/synapse-mark.png";
const FULL = "/brand/synapse-logo.png";

export default function Logo({ size = 32, layout = "mark", animated = false }) {
  const isFull = layout === "full" || layout === "row" || layout === "stack";
  const src = isFull ? FULL : MARK;
  // Le lockup est ~carré ; la marque est légèrement plus haute que large.
  const height = isFull ? size * 1.35 : size * 1.16;
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
