import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <section className="panel">
      <h2>Dashboard</h2>
      <p>
        Welcome, <strong>{user?.name || "User"}</strong>. This app runs a three-stage scraping
        workflow: fetching, extraction, and execution.
      </p>

      <div className="grid-two">
        <article className="feature-card">
          <h3>Start New Scrape</h3>
          <p>Fetch and extract headings, links, paragraphs, tables, or targeted nodes.</p>
          <Link to="/scrape" className="primary-link">
            Open Scrape Page
          </Link>
        </article>

        <article className="feature-card">
          <h3>Review History</h3>
          <p>See runtime, memory usage, efficiency ratio, and download CSV output.</p>
          <Link to="/history" className="primary-link">
            Open History Page
          </Link>
        </article>
      </div>
    </section>
  );
}
