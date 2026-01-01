import logo from "../../assets/NurotraLogo.png";
import "../../styles/auth.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { GOOGLE_AUTH_URL } from "../../config";

export default function SignUp() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" // consolidated role
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await signup(formData);
      // Redirect to OTP page
      navigate(`/verify-otp?email=${formData.email}`);
    } catch (err) {
      setError(err.message);
    }
  };

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
        {error && <p className="auth-error-msg">{error}</p>}

        <form onSubmit={handleSignup} className="auth-form-full">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            className="auth-input"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="auth-input"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="auth-input"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button type="submit" className="btn-primary auth-btn">Sign Up</button>
        </form>

        <div className="auth-separator">OR</div>

        <button
          onClick={() => window.location.href = GOOGLE_AUTH_URL}
          className="btn-secondary auth-btn btn-google"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="google-icon" />
          Continue with Google
        </button>

        <p className="auth-switch">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>Login</span>
        </p>
      </div>
    </div>
  );
}
