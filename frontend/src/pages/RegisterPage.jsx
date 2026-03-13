import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function RegisterPage() {
  const navigate     = useNavigate();
  const { register } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await register(form);
      toastSuccess("Account created! Welcome to Scrapi.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = err.message || "Registration failed. Please try again.";
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <img src="/Scrapy.png" alt="Scrapi Logo" style={{ width: 64, height: "auto" }} />
        <h2>Create your account</h2>
        <p>Start scraping in under a minute — free forever</p>
      </div>

      <form className="form-stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="name">Full name</label>
          <input
            id="name"
            name="name"
            type="text"
            className="input"
            value={form.name}
            onChange={onChange}
            placeholder="Jane Smith"
            required
            autoComplete="name"
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            value={form.email}
            onChange={onChange}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            value={form.password}
            onChange={onChange}
            placeholder="Min 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <span className="field-hint">At least 8 characters</span>
        </div>

        {error && (
          <div className="error-box" role="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading}
          style={{ marginTop: "0.25rem" }}
        >
          {loading ? (
            <>
              <span className="spinner spinner-sm" />
              Creating account…
            </>
          ) : (
            "Create account →"
          )}
        </button>
      </form>

      <div className="divider" style={{ marginTop: "1.5rem" }} />

      <p className="text-muted text-center">
        Already have an account?{" "}
        <Link to="/login" style={{ fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
