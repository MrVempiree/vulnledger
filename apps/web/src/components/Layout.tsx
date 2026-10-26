import { useAuth } from "../contexts/AuthContext";
import { useState, useCallback, ReactNode } from "react";

export interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <a href="/" className="brand" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event("nav:projects")); }}>
            VulnLedger
          </a>
          <nav className="nav">
            {isAuthenticated() && (
              <>
                <button className="nav-link" onClick={() => { window.dispatchEvent(new Event("nav:projects")); }}>
                  Projects
                </button>
                <span className="user">{user?.email} ({user?.role})</span>
                <button className="nav-link danger" onClick={logout}>
                  Log out
                </button>
              </>
            )}
          </nav>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            ☰
          </button>
        </div>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}
