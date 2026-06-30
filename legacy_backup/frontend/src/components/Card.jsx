export default function Card({ children, style = {}, ...rest }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 22,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
