import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(form);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel auth-panel">
      <h2>Register</h2>
      <p>Create an account to keep private scraping history.</p>

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Full Name
          <input
            name="name"
            type="text"
            value={form.name}
            onChange={onChange}
            required
            autoComplete="name"
          />
        </label>

        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        <ErrorMessage message={error} />

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>

        {loading ? <LoadingSpinner text="Creating account" /> : null}
      </form>

      <p className="helper-text">
        Already registered? <Link to="/login">Login</Link>
      </p>
    </section>
  );
}
