import { useState } from "react";

import axiosClient, { getApiErrorMessage } from "../api/axiosClient";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import MetricCard from "../components/MetricCard";

const initialForm = {
  url: "",
  target_tag: "",
  class_name: "",
  use_selenium_fallback: false,
};

function parseFilename(contentDisposition, fallback) {
  if (!contentDisposition) {
    return fallback;
  }

  const match = contentDisposition.match(/filename="?([^\"]+)"?/i);
  return match?.[1] || fallback;
}

function renderSimpleTable(rows, columnName) {
  if (!rows?.length) {
    return <p className="empty-text">No {columnName.toLowerCase()} extracted.</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{columnName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={`${columnName}-${index + 1}`}>
              <td>{index + 1}</td>
              <td>{item}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScrapePage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const onInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        url: form.url,
        use_selenium_fallback: form.use_selenium_fallback,
      };

      if (form.target_tag.trim()) {
        payload.target_tag = form.target_tag.trim();
      }

      if (form.class_name.trim()) {
        payload.class_name = form.class_name.trim();
      }

      const response = await axiosClient.post("/scrape", payload);
      setResult(response.data);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Scraping failed"));
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = async () => {
    if (!result?.id) {
      return;
    }

    setError("");
    setDownloading(true);

    try {
      const response = await axiosClient.get(`/scrape/history/${result.id}/csv`, {
        responseType: "blob",
      });

      const fallbackFilename = `scrape_${result.id}.csv`;
      const filename = parseFilename(
        response.headers["content-disposition"],
        fallbackFilename,
      );

      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError, "Could not download CSV"));
    } finally {
      setDownloading(false);
    }
  };

  const data = result?.data || {};

  return (
    <section className="panel">
      <h2>Scrape Page</h2>
      <p>Run the pipeline: Fetching -&gt; Extraction -&gt; Execution.</p>

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          URL
          <input
            name="url"
            type="url"
            value={form.url}
            onChange={onInputChange}
            placeholder="https://example.com"
            required
          />
        </label>

        <div className="grid-two">
          <label>
            Target Tag (optional)
            <input
              name="target_tag"
              type="text"
              value={form.target_tag}
              onChange={onInputChange}
              placeholder="div"
            />
          </label>

          <label>
            Class Name (optional)
            <input
              name="class_name"
              type="text"
              value={form.class_name}
              onChange={onInputChange}
              placeholder="card-title"
            />
          </label>
        </div>

        <label className="checkbox-line">
          <input
            name="use_selenium_fallback"
            type="checkbox"
            checked={form.use_selenium_fallback}
            onChange={onInputChange}
          />
          Use Selenium fallback for JavaScript-heavy pages
        </label>

        <ErrorMessage message={error} />

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Scraping..." : "Run Scrape"}
        </button>

        {loading ? <LoadingSpinner text="Fetching and extracting content" /> : null}
      </form>

      {result ? (
        <div className="result-wrap">
          <div className="result-header">
            <h3>Execution Result</h3>
            <button className="ghost-button" onClick={downloadCsv} disabled={downloading}>
              {downloading ? "Preparing CSV..." : "Download CSV"}
            </button>
          </div>

          <div className="meta-grid">
            <MetricCard label="Runtime (s)" value={result.metrics.runtime_seconds} />
            <MetricCard label="Memory (MB)" value={result.metrics.memory_usage_mb} />
            <MetricCard label="Traversed Nodes" value={result.metrics.traversed_nodes} />
            <MetricCard label="Extracted Nodes" value={result.metrics.extracted_nodes} />
            <MetricCard label="Efficiency (m/n)" value={result.metrics.efficiency_ratio} />
          </div>

          <p className="meta-text">
            URL: {result.url} | Dynamic Content: {result.dynamic_content_detected ? "Yes" : "No"} |
            Selenium Used: {result.used_selenium ? "Yes" : "No"}
          </p>

          <div className="output-grid">
            <article className="feature-card">
              <h4>Headings</h4>
              {renderSimpleTable(data.headings, "Heading")}
            </article>

            <article className="feature-card">
              <h4>Paragraphs</h4>
              {renderSimpleTable(data.paragraphs, "Paragraph")}
            </article>
          </div>

          <article className="feature-card">
            <h4>Links</h4>
            {data.links?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Text</th>
                      <th>Href</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.links.map((link, index) => (
                      <tr key={`link-${index + 1}`}>
                        <td>{index + 1}</td>
                        <td>{link.text}</td>
                        <td>{link.href}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-text">No links extracted.</p>
            )}
          </article>

          <article className="feature-card">
            <h4>Tables</h4>
            {data.tables?.length ? (
              data.tables.map((table, tableIndex) => (
                <div className="table-block" key={`table-${tableIndex + 1}`}>
                  <strong>Table {tableIndex + 1}</strong>
                  {table.rows?.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            {(table.headers?.length ? table.headers : ["Values"]).map(
                              (header, idx) => (
                                <th key={`header-${tableIndex + 1}-${idx}`}>{header}</th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, rowIndex) => (
                            <tr key={`row-${tableIndex + 1}-${rowIndex}`}>
                              {row.map((cell, cellIndex) => (
                                <td key={`cell-${tableIndex + 1}-${rowIndex}-${cellIndex}`}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty-text">No tabular rows extracted.</p>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-text">No tables extracted.</p>
            )}
          </article>

          <article className="feature-card">
            <h4>Targeted Extraction</h4>
            {data.targeted?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Text</th>
                      <th>Attributes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.targeted.map((item, index) => (
                      <tr key={`targeted-${index + 1}`}>
                        <td>{index + 1}</td>
                        <td>{item.text}</td>
                        <td>{JSON.stringify(item.attributes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-text">No targeted nodes extracted.</p>
            )}
          </article>
        </div>
      ) : null}
    </section>
  );
}
