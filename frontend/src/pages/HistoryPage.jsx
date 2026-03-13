import { useEffect, useMemo, useState } from "react";

import axiosClient, { getApiErrorMessage } from "../api/axiosClient";
import { useToast } from "../context/ToastContext";

function parseFilename(cd, fallback) {
  if (!cd) return fallback;
  const m = cd.match(/filename="?([^"]+)"?/i);
  return m?.[1] || fallback;
}

async function triggerDownload(id, format) {
  const ext = format === "json" ? "json" : "csv";
  const response = await axiosClient.get(`/scrape/history/${id}/${ext}`, {
    responseType: "blob",
  });
  const fallback = `scrapi_${id.slice(0, 8)}.${ext}`;
  const filename = parseFilename(response.headers["content-disposition"], fallback);
  const type = format === "json" ? "application/json" : "text/csv;charset=utf-8;";
  const blob = new Blob([response.data], { type });
  const url  = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.URL.revokeObjectURL(url);
}

const METHOD_BADGE = {
  pattern: { cls: "badge-green",  label: "Pattern" },
  table:   { cls: "badge-blue",   label: "Table"   },
  list:    { cls: "badge-purple", label: "List"     },
  classic: { cls: "badge-gray",   label: "Classic"  },
};

function HistoryRow({ item, onDownload, downloading }) {
  const date = new Date(item.created_at).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  let domain = item.url;
  try { domain = new URL(item.url).hostname; } catch { /* ok */ }

  const isDownloading = downloading === item.id;
  const methodMeta = METHOD_BADGE[item.detection_method] || METHOD_BADGE.classic;

  return (
    <tr>
      <td>
        <div className="td-url" title={item.url}>{domain}</div>
        <span className={`badge ${methodMeta.cls}`} style={{ marginTop: 4, display: "inline-flex" }}>
          {methodMeta.label}
        </span>
      </td>
      <td className="td-mono" style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
        {date}
      </td>
      <td className="td-mono">{item.metrics?.runtime_seconds?.toFixed(2)}s</td>
      <td className="td-mono">{item.record_count ?? item.metrics?.extracted_nodes ?? 0}</td>
      <td>
        <span className={`badge ${item.dynamic_content_detected ? "badge-orange" : "badge-green"}`}>
          {item.dynamic_content_detected ? "Dynamic" : "Static"}
        </span>
      </td>
      <td>
        <span className={`badge ${item.used_selenium ? "badge-orange" : "badge-gray"}`}>
          {item.used_selenium ? "Yes" : "No"}
        </span>
      </td>
      <td>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => onDownload(item.id, "csv")}
            disabled={isDownloading}
            title="Download CSV"
          >
            {isDownloading === "csv" ? <span className="spinner spinner-sm" /> : "CSV"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => onDownload(item.id, "json")}
            disabled={isDownloading}
            title="Download JSON"
          >
            {isDownloading === "json" ? <span className="spinner spinner-sm" /> : "JSON"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function HistoryPage() {
  const { toastSuccess, toastError } = useToast();

  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [downloading, setDownloading] = useState(""); // "id:format"

  const loadHistory = async () => {
    setError(""); setLoading(true);
    try {
      const res = await axiosClient.get("/scrape/history", { params: { limit: 100 } });
      setItems(res.data.items || []);
    } catch (err) {
      const msg = getApiErrorMessage(err, "Failed to load history");
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const onDownload = async (id, format) => {
    const key = `${id}:${format}`;
    setDownloading(key);
    try {
      await triggerDownload(id, format);
      toastSuccess(`${format.toUpperCase()} downloaded!`);
    } catch (err) {
      toastError(getApiErrorMessage(err, "Download failed"));
    } finally {
      setDownloading("");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.url.toLowerCase().includes(q));
  }, [items, search]);

  const stats = useMemo(() => ({
    total:   items.length,
    dynamic: items.filter((i) => i.dynamic_content_detected).length,
    records: items.reduce((s, i) => s + (i.record_count ?? i.metrics?.extracted_nodes ?? 0), 0),
  }), [items]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Scrape History</h2>
          <p>All your past scraping jobs — download exports anytime.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadHistory}
          disabled={loading}
        >
          {loading ? <><span className="spinner spinner-sm" /> Refreshing…</> : "↺ Refresh"}
        </button>
      </div>

      {/* Summary stats */}
      {!loading && items.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Jobs</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Records Extracted</div>
            <div className="stat-value">{stats.records.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Dynamic Pages</div>
            <div className="stat-value">{stats.dynamic}</div>
          </div>
        </div>
      )}

      {/* Search */}
      {items.length > 3 && (
        <div className="history-controls">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="input"
              placeholder="Filter by URL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSearch("")}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-box" role="alert">
          <span>⚠</span><span>{error}</span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="spinner-wrap">
          <div className="spinner" />
          <span>Loading scrape history…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card card-padded">
          <div className="empty-state">
            <div className="empty-icon">{search ? "🔍" : "📋"}</div>
            <strong>
              {search ? "No matches found" : "No scraping history yet"}
            </strong>
            <span>
              {search
                ? `No jobs match "${search}"`
                : "Run your first scrape and results will appear here."}
            </span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap" style={{ border: "none", borderRadius: "var(--radius-lg)" }}>
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Date</th>
                  <th>Runtime</th>
                  <th>Nodes</th>
                  <th>Type</th>
                  <th>Selenium</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    onDownload={onDownload}
                    downloading={downloading.startsWith(item.id) ? downloading.split(":")[1] : ""}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length < items.length && (
            <p className="text-muted text-sm" style={{ padding: "0.75rem 1rem" }}>
              Showing {filtered.length} of {items.length} jobs
            </p>
          )}
        </div>
      )}
    </div>
  );
}
