import logo from "../../assets/NurotraLogo.png";
import "../../styles/auth.css";
import BackgroundEffects from "../../components/BackgroundEffects";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      // Redirect to Main Landing Page as requested
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (

    <div className="auth-container">
      <div><BackgroundEffects /></div>
      <div className="auth-glow"></div>

      {/* Top Bar */}
      <div className="auth-top">
        <button onClick={() => navigate(-1)} className="auth-back-btn">
          ← Back
        </button>

        {/* Theme Toggle */}
        <button
          className="theme-toggle auth-toggle"
          onClick={() => {
            const root = document.documentElement;
            const next =
              root.getAttribute("data-theme") === "dark" ? "light" : "dark";
            root.setAttribute("data-theme", next);
            localStorage.setItem("theme", next);
          }}
        >
          🌙
        </button>
      </div>

      {/* Logo */}
      <div className="auth-logo-wrap">
        <img src={logo} className="auth-logo" alt="Nurotra logo" />
        <h2 className="auth-title">Welcome Back</h2>
      </div>

      {/* Form */}
      <div className="auth-card">
        {error && <p className="auth-error" style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <input
            type="email"
            placeholder="Email"
            className="auth-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="auth-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="btn-primary auth-btn">Login</button>
        </form>

        <p className="auth-switch">
          Don’t have an account?{" "}
          <span onClick={() => navigate("/signup")}>Sign Up</span>
        </p>
      </div>
    </div>
  );
}
