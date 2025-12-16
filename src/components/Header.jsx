import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/NurotraLogo.png";
import { useNavigate } from "react-router-dom";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  // Apply saved theme immediately
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Scroll: add/remove glass effect
  useEffect(() => {
    const header = document.querySelector("header");

    const onScroll = () => {
      if (window.scrollY > 20) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <header>
      {/* LOGO AREA (exact HTML structure restored) */}
      <div className="logo-wrap">
        <div className="logo-bg-glow"></div>

        <img src={logo} alt="Nurotra Logo" className="nav-logo" />

        <div className="logo">Nurotra</div>
      </div>

      {/* NAV LINKS */}
      <nav>
        <button
          id="theme-toggle"
          className="theme-toggle"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="welcome-text" style={{ fontSize: '0.9rem', opacity: 0.8 }}>Hi, {user.name}</span>

            <div
              onClick={() => navigate("/profile")}
              style={{
                cursor: 'pointer',
                fontSize: '1.5rem',
                background: 'rgba(255,255,255,0.1)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              className="header-profile-icon"
              title="View Profile"
            >
              👤
            </div>
          </div>
        ) : (
          <>
            <a onClick={() => navigate("/login")}>Login</a>
            <button
              className="btn-primary"
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
