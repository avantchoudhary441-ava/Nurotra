import logo from "../../assets/NurotraLogo.png";
import "../../styles/auth.css";
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
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
        <h2 className="auth-title">Create Your Account</h2>
      </div>

      {/* Form */}
      <div className="auth-card">
        <input type="text" placeholder="Full Name" className="auth-input" />
        <input type="email" placeholder="Email" className="auth-input" />
        <input type="password" placeholder="Password" className="auth-input" />

        <button className="btn-primary auth-btn">Sign Up</button>

        <p className="auth-switch">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>Login</span>
        </p>
      </div>
    </div>
  );
}
