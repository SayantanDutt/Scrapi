import { useEffect, useState } from "react";

import axiosClient, { getApiErrorMessage } from "../api/axiosClient";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";

function parseFilename(contentDisposition, fallback) {
  if (!contentDisposition) {
    return fallback;
  }

  const match = contentDisposition.match(/filename="?([^\"]+)"?/i);
  return match?.[1] || fallback;
}

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");
  const [error, setError] = useState("");

  const loadHistory = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await axiosClient.get("/scrape/history", {
        params: { limit: 50 },
      });
      setItems(response.data.items || []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Failed to load history"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const downloadCsv = async (id) => {
    setError("");
    setDownloadingId(id);

    try {
      const response = await axiosClient.get(`/scrape/history/${id}/csv`, {
        responseType: "blob",
      });

      const fallbackFilename = `scrape_${id}.csv`;
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
      setDownloadingId("");
    }
  };

  return (
    <section className="panel">
      <div className="result-header">
        <h2>Scrape History</h2>
        <button className="ghost-button" onClick={loadHistory} disabled={loading}>
          Refresh
        </button>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingSpinner text="Loading scrape history" />
      ) : items.length === 0 ? (
        <p className="empty-text">No scraping history found for your account.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>URL</th>
                <th>Runtime (s)</th>
                <th>Memory (MB)</th>
                <th>Nodes (m/n)</th>
                <th>Efficiency</th>
                <th>Dynamic</th>
                <th>Selenium</th>
                <th>CSV</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>{item.url}</td>
                  <td>{item.runtime_seconds}</td>
                  <td>{item.memory_usage_mb}</td>
                  <td>
                    {item.extracted_nodes}/{item.traversed_nodes}
                  </td>
                  <td>{item.efficiency_ratio}</td>
                  <td>{item.dynamic_content_detected ? "Yes" : "No"}</td>
                  <td>{item.used_selenium ? "Yes" : "No"}</td>
                  <td>
                    <button
                      className="inline-button"
                      onClick={() => downloadCsv(item.id)}
                      disabled={downloadingId === item.id}
                    >
                      {downloadingId === item.id ? "Downloading" : "Download"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
