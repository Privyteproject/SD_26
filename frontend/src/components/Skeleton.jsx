/**
 * Skeleton — composant de chargement
 * Utilisé dans toutes les pages pendant le fetch des données API.
 */
export function Skeleton({ width = "100%", height = 18, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, var(--sk-base) 25%, var(--sk-shine) 50%, var(--sk-base) 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

export function SkeletonCard({ c, rows = 3 }) {
  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.line}`,
      borderRadius: 14, padding: "16px 18px",
    }}>
      <Skeleton height={14} width="60%" style={{ marginBottom: 12 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={10} width={`${85 - i * 10}%`} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ c, count = 4, cols = 4 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 14,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} c={c} rows={2} />
      ))}
    </div>
  );
}

// CSS keyframes injectés une seule fois
export function SkeletonStyles({ c }) {
  const base  = c ? (c.line || "#E6D8BF") : "#E6D8BF";
  const shine = c ? (c.surface || "#FBF6EC") : "#FBF6EC";
  return (
    <style>{`
      :root {
        --sk-base:  ${base};
        --sk-shine: ${shine};
      }
      @keyframes skeleton-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );
}
