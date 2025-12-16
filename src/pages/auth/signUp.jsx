import logo from "../../assets/NurotraLogo.png";
import "../../styles/auth.css";
import { useNavigate } from "react-router-dom";

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function SignUp() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "influencer" // default
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const user = await signup(formData); // mockService adds ID/default stats
      // Redirect to Main Landing Page as requested
      navigate("/");
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
        {error && <p className="auth-error" style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}

        <form onSubmit={handleSignup} style={{ width: '100%' }}>
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

          {/* Role Selection */}
          <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0', justifyContent: 'center' }}>
            <label style={{ color: formData.role === 'influencer' ? '#fff' : '#888', cursor: 'pointer' }}>
              <input
                type="radio"
                name="role"
                value="influencer"
                checked={formData.role === "influencer"}
                onChange={handleChange}
              /> Influencer
            </label>
            <label style={{ color: formData.role === 'brand' ? '#fff' : '#888', cursor: 'pointer' }}>
              <input
                type="radio"
                name="role"
                value="brand"
                checked={formData.role === "brand"}
                onChange={handleChange}
              /> Brand
            </label>
          </div>

          <button type="submit" className="btn-primary auth-btn">Sign Up</button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>Login</span>
        </p>
      </div>
    </div>
  );
}
