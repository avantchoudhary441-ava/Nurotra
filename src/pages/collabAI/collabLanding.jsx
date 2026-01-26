
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/NurotraLogo.png";
import "../../styles/collabLanding.css";
import { useNavigate } from "react-router-dom";
import CurrencySelector from "../../components/CurrencySelector";
import BackgroundEffects from "../../components/BackgroundEffects";
import NuroLab from "../../components/Nuro/NuroLab";
import api from "../../services/apiService";

export default function CollabLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLabOpen, setLabOpen] = useState(false);
  const [deliverablesCount, setDeliverablesCount] = useState(0);

  const fetchDeliverablesCount = async () => {
    if (!user) return;
    try {
      const res = await api.get("/deliverables");
      setDeliverablesCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch (err) {
      console.error("Error fetching deliverables count", err);
    }
  };

  useState(() => {
    fetchDeliverablesCount();
  }, [user]);

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
        <div className="collab-top-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="icon-btn-floating"
            onClick={() => setLabOpen(true)}
            title="Open Nuro Lab"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.2rem'
            }}
          >
            🧪
          </button>
          <CurrencySelector />
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {user && user.profileImg && (
            <div className="profile-icon" style={{ position: 'relative' }}>
              <img
                src={user.profileImg}
                alt="Profile"
                className="collab-profile-img"
              />
              {deliverablesCount > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: '-10px',
                  right: '-10px',
                  background: 'rgba(0,0,0,0.8)',
                  color: '#4ade80',
                  border: '1px solid #4ade80',
                  borderRadius: '12px',
                  padding: '2px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}>
                  ✅ {deliverablesCount}
                </div>
              )}
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

      <NuroLab isOpen={isLabOpen} toggleLab={() => setLabOpen(false)} />
    </div>
  );
}
