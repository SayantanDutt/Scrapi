import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [form, setForm]     = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form);
      toastSuccess("Welcome back!");
      const redirectTo = location.state?.from?.pathname || "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg = err.message || "Login failed. Please try again.";
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <img src="/Scrapy.png" alt="Scrapi Logo" style={{ width: 50, height: "auto" }} />
        <h2>Welcome back</h2>
        <p>Sign in to your Scrapi account</p>
      </div>

      <form className="form-stack" onSubmit={onSubmit} noValidate>
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
            autoFocus
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
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
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
              Signing in…
            </>
          ) : (
            "Sign in →"
          )}
        </button>
      </form>

      <div className="divider" style={{ marginTop: "1.5rem" }} />

      <p className="text-muted text-center">
        Don't have an account?{" "}
        <Link to="/register" style={{ fontWeight: 600 }}>
          Create one free
        </Link>
      </p>
    </div>
  );
}
