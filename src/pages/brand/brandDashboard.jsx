// src/pages/brand/brandDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/dashboard.css";
import BackgroundEffects from "../../components/BackgroundEffects";

export default function BrandDashboard() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <div className="dashboard-page">
      <div><BackgroundEffects/></div>

      {/* NAVBAR */}
      <nav className={`dashboard-navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-left">
          <span className="nav-logo">🤝</span>
          <span className="nav-brand">CollabAI</span>
        </div>

        <div className="nav-right">
          <button className="theme-toggle" onClick={toggleTheme}>🌙</button>
          <div className="nav-profile">🏢</div>
        </div>
      </nav>

      {/* BODY */}
      <div className="dashboard-body">

        {/* PROFILE CARD */}
        <section className="profile-card">
          <div className="profile-right">
            <div className="profile-photo brand-photo">🏢</div>
            <div>
              <div className="profile-name">Nike India</div>
              <div className="profile-sub">Enterprise Brand</div>
            </div>
          </div>

          <div className="profile-left">
            <button className="btn-outline">Edit Profile</button>
            <button className="btn-outline">Settings</button>
            <button className="btn-dots">⋯</button>
          </div>
        </section>

        {/* SIDEBAR + ANALYTICS */}
        <div className="dashboard-row">

          {/* SIDEBAR CARD */}
          <aside className="sidebar-card">
            {[
              "Profile",
              "Active Campaigns",
              "Past Collaborations",
              "Analytics",
              "Settings",
              "Logout",
            ].map((item) => (
              <div key={item} className="sidebar-item">
                {item}
              </div>
            ))}
          </aside>

          {/* ANALYTICS GRID */}
          <main className="analytics-grid">
            <div className="card neon-card">
              <h4>Total Collaborations</h4>
              <div className="big-number">42</div>
            </div>

            <div className="card neon-card center">
              <h4>Brand Reach</h4>
              <div className="big-number">Top 8%</div>
            </div>

            <div className="card neon-card">
              <h4>Active Campaigns</h4>
              <div className="big-number">5</div>
            </div>

            <div className="card neon-card">
              <h4>Brand Badges</h4>
              <div className="badges-grid">
                <div className="badge">🔥 Trusted</div>
                <div className="badge">⚡ Fast Pay</div>
                <div className="badge">💎 Premium</div>
              </div>
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}
