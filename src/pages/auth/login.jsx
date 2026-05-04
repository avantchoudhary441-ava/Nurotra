import logo from "../../assets/NurotraLogo.png";
import "../../styles/auth.css";
import BackgroundEffects from "../../components/BackgroundEffects";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { GOOGLE_AUTH_URL } from "../../config";

export default function Login() {
  const navigate = useNavigate();
  const { user, login, loginWithToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const processingRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Check for token and trigger loginWithToken
  useEffect(() => {
    let token = searchParams.get("token");
    let errorParam = searchParams.get("error");

    if (!token && !errorParam && window.location.hash.includes("?")) {
      const hashQuery = window.location.hash.split("?")[1];
      const params = new URLSearchParams(hashQuery);
      token = params.get("token");
      errorParam = params.get("error");
    }

    if (errorParam) {
      setError(errorParam === 'EmailExists' ? "Account already exists with this email." : "Authentication Error.");
      setSearchParams({}, { replace: true });
    }

    if (token && !processingRef.current) {
      processingRef.current = true;
      setIsGoogleAuth(true);

      // Attempt login
      loginWithToken(token).catch(err => {
        console.error("Google Login Error:", err);
        setError("Google Login Failed: " + (err.message || "Unknown error"));
        setIsGoogleAuth(false);
        processingRef.current = false;
      });

      // Clear params immediately to keep URL clean
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, loginWithToken, setSearchParams]);

  // 2. Safe Navigation: Use window.location.href for "Hard Sync" to home
  useEffect(() => {
    if (user && isGoogleAuth) {
      // Small timeout to ensure localStorage is settled
      setTimeout(() => {
        window.location.href = "/#/";
      }, 500);
    }
  }, [user, isGoogleAuth]);

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
            window.location.href = GOOGLE_AUTH_URL;
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
