import { Sun, Moon } from "lucide-react";
import { useTheme } from "../app/providers/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Theme"
      style={{
        width: 38, height: 38, borderRadius: 9,
        border: "1px solid var(--line)", background: "var(--surface)",
        color: "var(--ink)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
