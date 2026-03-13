import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import axiosClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="stat-card">
      <div className="flex-between gap-2">
        <span className="stat-label">{label}</span>
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function RecentRow({ item }) {
  const date = new Date(item.created_at).toLocaleString(undefined, {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute:"2-digit",
  });
  const domain = (() => {
    try { return new URL(item.url).hostname; } catch { return item.url; }
  })();

  return (
    <tr>
      <td>
        <div className="td-url" title={item.url}>{domain}</div>
        <div className="text-muted" style={{ fontSize: "0.73rem", marginTop: 2 }}>{date}</div>
      </td>
      <td className="td-mono">{item.metrics?.runtime_seconds?.toFixed(2) ?? "—"}s</td>
      <td className="td-mono">{item.record_count ?? item.metrics?.extracted_nodes ?? 0}</td>
      <td>
        {item.dynamic_content_detected
          ? <span className="badge badge-orange">Dynamic</span>
          : <span className="badge badge-green">Static</span>}
      </td>
      <td>
        <Link to="/history" className="btn btn-sm btn-ghost">View →</Link>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosClient.get("/scrape/history", { params: { limit: 5 } })
      .then((r) => setHistory(r.data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalNodes = history.reduce((s, i) => s + (i.record_count ?? i.metrics?.extracted_nodes ?? 0), 0);
  const avgRuntime = history.length
    ? (history.reduce((s, i) => s + (i.metrics?.runtime_seconds ?? 0), 0) / history.length).toFixed(2)
    : "—";
  const dynamicCount = history.filter((i) => i.dynamic_content_detected).length;

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: "1.6rem", letterSpacing: "-0.5px", marginBottom: "0.25rem" }}>
          Hey, {firstName} 👋
        </h2>
        <p className="text-muted">Here's an overview of your scraping activity.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          label="Total Scrapes"
          value={history.length}
          sub="in recent history"
          icon="🔍"
        />
        <StatCard
          label="Records Extracted"
          value={totalNodes.toLocaleString()}
          sub="structured data rows"
          icon="📦"
        />
        <StatCard
          label="Avg Runtime"
          value={avgRuntime === "—" ? "—" : `${avgRuntime}s`}
          sub="per scrape job"
          icon="⚡"
        />
        <StatCard
          label="Dynamic Pages"
          value={dynamicCount}
          sub="JS-rendered detected"
          icon="⚙️"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Quick actions
        </h3>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h3>New Scrape</h3>
            <p>Enter a URL, run the extraction pipeline, and get clean structured data.</p>
            <Link to="/scrape" className="btn btn-primary btn-sm" style={{ marginTop: "auto" }}>
              Start scraping →
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📋</div>
            <h3>Job History</h3>
            <p>Review past scrapes, re-download exports, and view detailed metrics.</p>
            <Link to="/history" className="btn btn-secondary btn-sm" style={{ marginTop: "auto" }}>
              View history →
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon">◈</div>
            <h3>Smart Detection</h3>
            <p>Automatically detects product cards, article blocks, tables, and list patterns.</p>
            <Link to="/scrape" className="btn btn-secondary btn-sm" style={{ marginTop: "auto" }}>
              Try it →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card card-padded">
        <div className="flex-between" style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Recent activity</h3>
          <Link to="/history" className="btn btn-sm btn-ghost">See all →</Link>
        </div>

        {loading ? (
          <div className="spinner-wrap" style={{ padding: "1.5rem" }}>
            <div className="spinner" />
            <span>Loading history…</span>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <strong>No scrapes yet</strong>
            <span>Run your first scrape to see activity here.</span>
            <Link to="/scrape" className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem" }}>
              Start now →
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>URL / Date</th>
                  <th>Runtime</th>
                  <th>Nodes</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => <RecentRow key={item.id} item={item} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
