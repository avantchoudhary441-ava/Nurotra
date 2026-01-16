import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import CurrencySelector from "./CurrencySelector";
import logo from "../assets/NurotraLogo.png";
import { useNavigate } from "react-router-dom";
import "../styles/header.css";

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

  const isDarkMode = theme === "dark";

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
        <div className="nav-actions">
          <CurrencySelector />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
        </div>

        {user ? (
          <div className="header-user-section">
            {user.role === 'admin' && (
              <button
                className="btn-outline header-admin-btn"
                onClick={() => navigate("/admin/dashboard")}
              >
                Admin Dashboard
              </button>
            )}
            <span className="welcome-text header-welcome-text">Hi, {user.name}</span>

            <div
              onClick={() => navigate("/profile")}
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
