import { useState, useMemo } from "react";
import axiosClient, { getApiErrorMessage } from "../api/axiosClient";
import { useToast } from "../context/ToastContext";

/* ─────────────────────────────────────────────────────────────────────────────
   Download helper
───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   Detection badge
───────────────────────────────────────────────────────────────────────────── */
const METHOD_META = {
  pattern: { label: "Pattern Detection",  color: "badge-green",  icon: "◈" },
  table:   { label: "HTML Table",         color: "badge-blue",   icon: "⊞" },
  list:    { label: "List Items",         color: "badge-purple", icon: "☰" },
  classic: { label: "Classic Extraction", color: "badge-gray",   icon: "◇" },
};

function DetectionBanner({ result }) {
  const method = result.detection_method || "classic";
  const meta   = METHOD_META[method] || METHOD_META.classic;

  return (
    <div className="detection-banner">
      <div className="detection-banner-left">
        <span className={`badge ${meta.color}`}>
          {meta.icon} {meta.label}
        </span>
        {result.detected_pattern && (
          <code className="pattern-code">{result.detected_pattern}</code>
        )}
      </div>
      <div className="detection-banner-right">
        <span className="detection-count">
          <strong>{result.record_count}</strong> records extracted
        </span>
        {result.columns?.length > 0 && (
          <span className="detection-cols">
            {result.columns.length} {result.columns.length === 1 ? "column" : "columns"}
          </span>
        )}
        {result.dynamic_content_detected && (
          <span className="badge badge-orange">JS-rendered</span>
        )}
        {result.used_selenium && (
          <span className="badge badge-green">Selenium</span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Smart data table with pagination and column visibility
───────────────────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 50;

function DataTable({ records, columns }) {
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [hiddenCols, setHiddenCols] = useState(new Set());

  const visibleCols = columns.filter(c => !hiddenCols.has(c));

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r =>
      Object.values(r).some(v => String(v).toLowerCase().includes(q))
    );
  }, [records, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleCol = (col) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  };

  if (!records?.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <strong>No data extracted</strong>
        <span>The page may be empty, blocked, or require JavaScript rendering.</span>
      </div>
    );
  }

  const isUrl = (val) => {
    try { return new URL(String(val)).protocol.startsWith("http"); }
    catch { return false; }
  };

  const isImage = (col, val) => {
    return (col === "image" || col.includes("img")) &&
      typeof val === "string" &&
      /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(val);
  };

  return (
    <div className="data-table-section">
      {/* Toolbar */}
      <div className="data-table-toolbar">
        <div className="search-input-wrap" style={{ maxWidth: 280 }}>
          <span className="search-icon">⌕</span>
          <input
            type="text"
            className="input"
            placeholder="Filter rows…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="col-toggles">
          {columns.map(col => (
            <button
              key={col}
              type="button"
              className={`col-toggle-btn ${hiddenCols.has(col) ? "inactive" : "active"}`}
              onClick={() => toggleCol(col)}
              title={hiddenCols.has(col) ? `Show ${col}` : `Hide ${col}`}
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: "center" }}>#</th>
              {visibleCols.map(col => (
                <th key={col}>{col.replace(/_/g, " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, ri) => (
              <tr key={ri}>
                <td className="td-mono" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  {(page - 1) * PAGE_SIZE + ri + 1}
                </td>
                {visibleCols.map(col => {
                  const val = row[col] ?? "";
                  return (
                    <td key={col}>
                      {isImage(col, val) ? (
                        <img
                          src={val}
                          alt={row.title || col}
                          className="table-thumb"
                          loading="lazy"
                          onError={e => { e.target.style.display = "none"; }}
                        />
                      ) : isUrl(val) ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="td-url"
                          title={val}
                        >
                          {val.length > 60 ? val.slice(0, 57) + "…" : val}
                        </a>
                      ) : (
                        <span className={col === "price" ? "price-cell" : undefined}>
                          {String(val)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Prev
          </button>
          <span className="pagination-info">
            Page {page} of {totalPages}
            <span className="text-muted"> ({filtered.length} rows)</span>
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}

      {filtered.length === 0 && search && (
        <p className="text-muted text-sm text-center" style={{ padding: "1rem" }}>
          No rows match "{search}"
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────────────────── */
export default function ScrapePage() {
  const { toastSuccess, toastError, toastInfo } = useToast();

  const [url, setUrl]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [result, setResult]     = useState(null);
  const [downloading, setDownloading] = useState("");
  const [phase, setPhase]       = useState("");

  const PHASES = [
    "Fetching page…",
    "Analysing DOM structure…",
    "Detecting repeating patterns…",
    "Extracting structured data…",
    "Cleaning and normalising…",
  ];

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError(""); setResult(null); setLoading(true); setPhase(PHASES[0]);

    // Cycle phase labels for perceived progress
    let phaseIdx = 0;
    const phaseTimer = setInterval(() => {
      phaseIdx = Math.min(phaseIdx + 1, PHASES.length - 1);
      setPhase(PHASES[phaseIdx]);
    }, 1800);

    try {
      toastInfo("Running smart scrape pipeline…");
      const res = await axiosClient.post("/scrape", { url: url.trim(), use_selenium_fallback: true });
      setResult(res.data);
      toastSuccess(`Done — ${res.data.record_count} records extracted via ${res.data.detection_method}.`);
    } catch (err) {
      const msg = getApiErrorMessage(err, "Scraping failed");
      setError(msg);
      toastError(msg);
    } finally {
      clearInterval(phaseTimer);
      setLoading(false);
      setPhase("");
    }
  };

  const download = async (format) => {
    if (!result?.id) return;
    setDownloading(format);
    try {
      await triggerDownload(result.id, format);
      toastSuccess(`${format.toUpperCase()} downloaded!`);
    } catch (err) {
      toastError(getApiErrorMessage(err, "Download failed"));
    } finally {
      setDownloading("");
    }
  };

  const metrics = result?.metrics;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h2>New Scrape</h2>
          <p>Enter any URL — Scrapi automatically detects structure and extracts a clean dataset.</p>
        </div>
      </div>

      {/* Form */}
      <div className="card card-padded">
        <form className="form-stack" onSubmit={onSubmit} noValidate>

          <div className="field">
            <label className="field-label" htmlFor="url">Target URL</label>
            <div className="url-input-row">
              <input
                id="url"
                type="url"
                className="input"
                value={url}
                onChange={e => { setUrl(e.target.value); if (error) setError(""); }}
                placeholder="https://example.com/products"
                required
                autoComplete="url"
              />
              <button
                type="submit"
                className="btn btn-primary btn-scrape"
                disabled={loading || !url.trim()}
              >
                {loading
                  ? <><span className="spinner spinner-sm" /> Scraping…</>
                  : "▶ Scrape"}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-box" role="alert">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-3)", marginBottom: "0.3rem" }}>
                <span>{phase}</span>
              </div>
              <div className="progress-bar-wrap progress-indeterminate">
                <div className="progress-bar-fill" />
              </div>
            </div>
          )}
        </form>

        {/* Pipeline info */}
        <div className="pipeline-steps">
          {[
            { icon: "⬇", label: "Fetch", desc: "HTTP + retry" },
            { icon: "⚙", label: "Render", desc: "JS detection" },
            { icon: "◈", label: "Detect", desc: "DOM patterns" },
            { icon: "⊞", label: "Extract", desc: "Smart fields" },
            { icon: "✦", label: "Clean", desc: "Normalize" },
          ].map((s, i) => (
            <div key={i} className="pipeline-step">
              <span className="pipeline-step-icon">{s.icon}</span>
              <span className="pipeline-step-label">{s.label}</span>
              <span className="pipeline-step-desc">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="result-section">

          {/* Header */}
          <div className="result-header">
            <h3>Extraction Result</h3>
            <div className="download-group">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => download("csv")}
                disabled={!!downloading || !result.record_count}
              >
                {downloading === "csv"
                  ? <><span className="spinner spinner-sm" /> Preparing…</>
                  : "⬇ Download CSV"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => download("json")}
                disabled={!!downloading || !result.record_count}
              >
                {downloading === "json"
                  ? <><span className="spinner spinner-sm" /> Preparing…</>
                  : "⬇ Download JSON"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setResult(null); setUrl(""); }}
              >
                ✕ Clear
              </button>
            </div>
          </div>

          {/* Detection banner */}
          <DetectionBanner result={result} />

          {/* Metrics row */}
          <div className="stats-grid">
            <MetricCard label="Runtime"    value={`${metrics.runtime_seconds}s`} />
            <MetricCard label="Memory"     value={`${metrics.memory_usage_mb} MB`} />
            <MetricCard label="DOM Nodes"  value={metrics.traversed_nodes} />
            <MetricCard label="Records"    value={result.record_count} highlight />
            <MetricCard
              label="Efficiency"
              value={(metrics.efficiency_ratio * 100).toFixed(1) + "%"}
            />
          </div>

          {/* Meta pills */}
          <div className="scrape-meta">
            {(() => {
              try { return <span className="meta-pill">🌐 {new URL(result.url).hostname}</span>; }
              catch { return <span className="meta-pill">🌐 {result.url}</span>; }
            })()}
            {result.columns?.map(col => (
              <span key={col} className="meta-pill col-pill">{col.replace(/_/g, " ")}</span>
            ))}
          </div>

          {/* Primary data table */}
          <div className="card card-padded">
            <div className="table-section-header">
              <h4>Extracted Dataset</h4>
              <span className="text-muted text-sm">
                {result.record_count} rows · {result.columns?.length ?? 0} columns
              </span>
            </div>
            <DataTable records={result.records} columns={result.columns ?? []} />
          </div>

          {/* Classic fallback accordion */}
          {(result.headings?.length > 0 || result.links?.length > 0 || result.paragraphs?.length > 0) && (
            <ClassicDataAccordion result={result} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Classic data accordion (headings / links / paragraphs)
───────────────────────────────────────────────────────────────────────────── */
function ClassicDataAccordion({ result }) {
  const [open, setOpen] = useState(false);

  const sections = [
    result.headings?.length   && { key: "h", label: `Headings (${result.headings.length})` },
    result.links?.length      && { key: "l", label: `Links (${result.links.length})` },
    result.paragraphs?.length && { key: "p", label: `Paragraphs (${result.paragraphs.length})` },
  ].filter(Boolean);

  const [activeSection, setActiveSection] = useState(sections[0]?.key ?? "h");

  if (!sections.length) return null;

  return (
    <div className="card classic-accordion">
      <button
        type="button"
        className="accordion-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>Additional extracted data</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="accordion-body">
          <div className="tab-list" role="tablist" style={{ padding: "0 1rem" }}>
            {sections.map(s => (
              <button
                key={s.key}
                type="button"
                className={`tab-btn${activeSection === s.key ? " active" : ""}`}
                onClick={() => setActiveSection(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "0 1rem 1rem" }}>
            {activeSection === "h" && result.headings?.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Level</th><th>Text</th></tr></thead>
                  <tbody>
                    {result.headings.map((h, i) => (
                      <tr key={i}>
                        <td className="td-mono">{i + 1}</td>
                        <td><span className="badge badge-green">{h.level?.toUpperCase()}</span></td>
                        <td>{h.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeSection === "l" && result.links?.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Text</th><th>URL</th><th>Type</th></tr></thead>
                  <tbody>
                    {result.links.map((l, i) => (
                      <tr key={i}>
                        <td className="td-mono">{i + 1}</td>
                        <td>{l.text}</td>
                        <td>
                          <a href={l.href} target="_blank" rel="noreferrer noopener"
                            className="td-url" title={l.href}>
                            {l.href?.length > 60 ? l.href.slice(0, 57) + "…" : l.href}
                          </a>
                        </td>
                        <td>
                          {l.is_external
                            ? <span className="badge badge-orange">External</span>
                            : <span className="badge badge-gray">Internal</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeSection === "p" && result.paragraphs?.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Content</th></tr></thead>
                  <tbody>
                    {result.paragraphs.map((p, i) => (
                      <tr key={i}>
                        <td className="td-mono">{i + 1}</td>
                        <td>{p.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */
function MetricCard({ label, value, highlight }) {
  return (
    <div className={`stat-card${highlight ? " stat-card-highlight" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: "1.15rem" }}>{value}</div>
    </div>
  );
}
