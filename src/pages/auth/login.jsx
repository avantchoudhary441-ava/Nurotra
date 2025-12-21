import logo from "../../assets/NurotraLogo.png";
import "../../styles/auth.css";
import BackgroundEffects from "../../components/BackgroundEffects";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);

  // Check for Google Auth Token
  const processingRef = useRef(false);

  // Check for Google Auth Token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token && !processingRef.current) {
      processingRef.current = true;
      setIsGoogleAuth(true);

      console.log("Token found, attempting login...");
      loginWithToken(token)
        .then((userData) => {
          console.log("Login successful:", userData);
          // Only clear URL on success to avoid aggressive cleanup
          window.history.replaceState({}, document.title, "/login");
          navigate("/");
        })
        .catch(err => {
          console.error("Google Login Error:", err);
          setError("Google Login Failed: " + err.message);
          setIsGoogleAuth(false);
          processingRef.current = false; // Allow retry
        });
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      // Redirect Admin to Dashboard
      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (isGoogleAuth) {
    return (
      <div className="auth-container auth-loading-container">
        <BackgroundEffects />
        <div className="auth-card auth-loading-card">
          <h2 className="auth-title">Authenticating...</h2>
          <p>Please wait while we verify your Google account.</p>
        </div>
      </div>
    );
  }

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
        {error && <p className="auth-error-msg">{error}</p>}
        <form onSubmit={handleLogin} className="auth-form-full">
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

        <div className="auth-separator">OR</div>

        <button
          onClick={() => {
            window.location.href = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/google`;
          }}

          className="btn-secondary auth-btn btn-google"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="google-icon" />
          Continue with Google
        </button>

        <p className="auth-switch">
          Don’t have an account?{" "}
          <span onClick={() => navigate("/signup")}>Sign Up</span>
        </p>
      </div>
    </div>
  );
}
