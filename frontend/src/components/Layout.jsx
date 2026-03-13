import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const navStyle = ({ isActive }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

function LogoIcon() {
  return (
    <img 
      src="/Scrapy.png" 
      alt="Scrapi Logo" 
      style={{ width: '95px', height: 'auto', display: 'block' }} 
    />
  );
}

export default function Layout({ children }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isLanding = location.pathname === "/" && !isAuthenticated;

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("scrapi_theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("scrapi_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="brand-logo">
          <LogoIcon />
          <div>
            {/* <div className="brand-name">Scrapi</div>
            <div className="brand-tag">Web Scraping Platform</div> */}
          </div>
        </Link>

        {isAuthenticated ? (
          <>
            <nav aria-label="Main navigation">
              <ul className="nav-list">
                <li><NavLink to="/dashboard" className={navStyle}>Dashboard</NavLink></li>
                <li><NavLink to="/scrape"    className={navStyle}>New Scrape</NavLink></li>
                <li><NavLink to="/history"   className={navStyle}>History</NavLink></li>
              </ul>
            </nav>

            <div className="nav-right">
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                aria-label="Toggle theme"
              >
                {theme === "light" ? "🌙" : "☀️"}
              </button>
              <div className="user-chip">
                <div className="user-avatar" aria-hidden="true">{initials}</div>
                <span>{user?.name?.split(" ")[0] || "User"}</span>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <div className="nav-right">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              aria-label="Toggle theme"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <NavLink to="/login"    className={navStyle}>Sign in</NavLink>
            <NavLink to="/register" className="btn btn-sm btn-primary">
              Get started
            </NavLink>
          </div>
        )}
      </header>

      {isLanding ? (
        <main>{children}</main>
      ) : (
        <main className="content-wrap">{children}</main>
      )}
    </div>
  );
}
