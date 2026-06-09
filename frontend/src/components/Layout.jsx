import { useState, useEffect } from "react";
import { Sun, Moon, Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function Layout({ c, dark, setDark, children, title, subtitle, role = "collab", userName, userInitials, userSubtitle, topbarRight }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = vw < 768;

  return (
    <div style={{
      minHeight: "100vh", width: "100%", background: c.bg,
      color: c.ink, fontFamily: "ui-sans-serif, system-ui, sans-serif",
      display: "flex", transition: "background .4s",
    }}>
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 40 }} />
      )}

      <Sidebar
        c={c} role={role}
        userName={userName} userInitials={userInitials} userSubtitle={userSubtitle}
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{
          height: 58, background: c.surface, borderBottom: `1px solid ${c.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", position: "sticky", top: 0, zIndex: 30,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)}
                style={{ background: "none", border: "none", cursor: "pointer", color: c.ink, display: "flex" }}>
                <Menu size={22} />
              </button>
            )}
            <div>
              {title && <div style={{ fontSize: 15, fontWeight: 600, color: c.ink }}>{title}</div>}
              {subtitle && <div style={{ fontSize: 11, color: c.muted }}>{subtitle}</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {topbarRight}
            <button onClick={() => setDark(!dark)}
              style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.line}`, background: c.surface, color: c.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {dark ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: isMobile ? 14 : 24, overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
