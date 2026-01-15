
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/NurotraLogo.png";
import "../../styles/collabLanding.css";
import { useNavigate } from "react-router-dom";
import BackgroundEffects from "../../components/BackgroundEffects";

export default function CollabLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  document.documentElement.setAttribute("data-theme", theme);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <div className="collab-container">
      <div><BackgroundEffects /></div>

      <div className="collab-glow"></div>

      {/* TOP BAR — Only Left + Right */}
      <div className="collab-top">

        {/* LEFT: BACK BUTTON */}
        <button onClick={() => navigate(-1)} className="back-btn">
          ← Back
        </button>


        {/* RIGHT: THEME + PROFILE */}
        <div className="collab-top-right">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {user && user.profileImg && (
            <div className="profile-icon">
              <img
                src={user.profileImg}
                alt="Profile"
                className="collab-profile-img"
              />
            </div>
          )}
        </div>

      </div>

      {/* MAIN HERO LOGO (center of page) */}
      <div className="collab-hero-logo-wrap">
        <img src={logo} className="collab-hero-logo" alt="Nurotra Logo" />
        <h2 className="collab-hero-title">Collaborator</h2>
      </div>

      {/* CONTENT */}
      <div className="collab-content">
        <h1 className="collab-title">
          Connect. <span className="gradient-text">Collab.</span> Conquer.
        </h1>

        <p className="collab-sub">
          AI-powered matchmaking for Influencers & Brands — fast, reliable, smart.
        </p>

        <div className="collab-actions">
          <button
            className="btn-primary big-btn" onClick={() => navigate("/influencer-form")} >
            I'm an Influencer
          </button>

          <button
            className="btn-secondary big-btn" onClick={() => navigate("/brand-form")}>
            I'm a Brand
          </button>

        </div>
      </div>

    </div>
  );
}
