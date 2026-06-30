// Carte basée sur le kit officiel (.sd-card). `style` permet les surcharges ponctuelles
// (padding 0, marges…) sans casser le design du kit.
export default function Card({ children, style = {}, className = "", ...rest }) {
  return (
    <div className={`sd-card ${className}`.trim()} style={style} {...rest}>
      {children}
    </div>
  );
}
