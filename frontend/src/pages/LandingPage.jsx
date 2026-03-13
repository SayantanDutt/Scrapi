import { Link } from "react-router-dom";
import { useEffect } from "react";

const FEATURES = [
  {
    icon: "⚡",
    title: "Multi-Strategy Pipeline",
    desc: "Fetch → Detect → Extract → Clean. Automatically falls back to Selenium for JavaScript-rendered pages, with retry logic and timeout handling.",
  },
  {
    icon: "◈",
    title: "Automatic Pattern Detection",
    desc: "Detects repeating DOM structures like product cards, article blocks, and table rows — no CSS selectors or manual config required.",
  },
  {
    icon: "📊",
    title: "Unified Table Preview",
    desc: "Results shown in a clean, searchable, paginated table before download. Toggle columns, filter rows, and see image thumbnails inline.",
  },
  {
    icon: "📦",
    title: "JSON & CSV Export",
    desc: "Download structured data as clean CSV or JSON. Normalized field names, deduplicated rows, and consistent schema across all exports.",
  },
  {
    icon: "🧹",
    title: "Smart Data Cleaning",
    desc: "Whitespace normalization, duplicate removal, empty field filtering, and snake_case field naming — analysis-ready out of the box.",
  },
  {
    icon: "🕐",
    title: "Full Job History",
    desc: "Every scrape is persisted to your account. Review detection method, re-download exports, and track your extraction history anytime.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Sign Up Free",
    desc: "Create an account in seconds. No credit card required.",
  },
  {
    n: "2",
    title: "Enter a URL",
    desc: "Paste any webpage URL — Scrapi handles everything automatically, no configuration needed.",
  },
  {
    n: "3",
    title: "Run the Scrape",
    desc: "The pipeline fetches, extracts, cleans, and structures the data automatically.",
  },
  {
    n: "4",
    title: "Download & Analyse",
    desc: "Preview the results, then download clean CSV or JSON — ready for analysis.",
  },
];

export default function LandingPage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-badge">
          <span>✦</span>
          <span>Open-Source Web Scraping Platform</span>
        </div>

        <h1>
          Extract the Web's Data —{" "}
          <span className="gradient-text">Instantly & Cleanly</span>
        </h1>

        <p>
          Scrapi is a developer-grade scraping tool that fetches any webpage,
          extracts structured content, and delivers clean, analysis-ready CSV
          and JSON exports in seconds.
        </p>

        <div className="hero-cta">
          <Link to="/register" className="btn btn-primary btn-lg">
            Start scraping free →
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            Sign in
          </Link>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="value">3-stage</div>
            <div className="label">Pipeline</div>
          </div>
          <div className="hero-stat">
            <div className="value">5+</div>
            <div className="label">Content Types</div>
          </div>
          <div className="hero-stat">
            <div className="value">CSV+JSON</div>
            <div className="label">Export Formats</div>
          </div>
          <div className="hero-stat">
            <div className="value">Retry</div>
            <div className="label">Auto-Fallback</div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section">
        <div className="reveal">
          <span className="section-label">Features</span>
          <h2 className="section-title">
            Everything you need to scrape the web
          </h2>
          <p className="section-subtitle">
            From raw HTML to structured datasets — Scrapi handles the entire
            pipeline so you can focus on what the data means.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="feature-item reveal"
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              <div className="fi-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="how-section">
        <div className="how-inner">
          <div className="reveal">
            <span className="section-label">How it works</span>
            <h2 className="section-title">
              From URL to dataset in four steps
            </h2>
            <p className="section-subtitle">
              No config files, no selectors required for basic extraction.
              Just a URL and a click.
            </p>
          </div>

          <div className="steps-grid">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="step reveal"
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="step-number">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="cta-inner reveal">
          <h2>
            Ready to start{" "}
            <span className="gradient-text">scraping smarter?</span>
          </h2>
          <p>
            Create your free account and run your first scrape in under a
            minute. No setup, no configuration.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary btn-lg">
              Create free account →
            </Link>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <p>
          Scrapi — Web Scraping Platform · Built with FastAPI + React +
          MongoDB
        </p>
      </footer>

    </div>
  );
}
