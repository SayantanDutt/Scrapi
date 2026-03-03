import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const activeStyle = ({ isActive }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

export default function Layout({ children }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>Automated Web Scraper</h1>
          <p>FastAPI + React + MongoDB Pipeline</p>
        </div>

        {isAuthenticated ? (
          <>
            <nav className="nav-list" aria-label="Main navigation">
              <NavLink to="/dashboard" className={activeStyle}>
                Dashboard
              </NavLink>
              <NavLink to="/scrape" className={activeStyle}>
                Scrape
              </NavLink>
              <NavLink to="/history" className={activeStyle}>
                History
              </NavLink>
            </nav>

            <div className="user-actions">
              <span className="user-chip">{user?.name || "User"}</span>
              <button className="ghost-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </>
        ) : (
          <nav className="nav-list" aria-label="Auth navigation">
            <NavLink to="/login" className={activeStyle}>
              Login
            </NavLink>
            <NavLink to="/register" className={activeStyle}>
              Register
            </NavLink>
          </nav>
        )}
      </header>

      <main className="content-wrap">{children}</main>
    </div>
  );
}
