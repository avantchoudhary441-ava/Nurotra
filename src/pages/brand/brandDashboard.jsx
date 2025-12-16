// src/pages/brand/brandDashboard.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import "../../styles/dashboard.css";
import LineStatsChart from "../../components/charts/LineStatsChart";
import BarRankChart from "../../components/charts/BarRankChart";
import BackgroundEffects from "../../components/BackgroundEffects";


export default function BrandDashboard() {
  const { user, logout } = useAuth();
  const data = user || {};

  const [scrolled, setScrolled] = useState(false);

  /* ---------------- NAVBAR SCROLL GLASS ---------------- */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------------- THEME TOGGLE ---------------- */
  const toggleTheme = () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  /* ---------------- MOCK ANALYTICS ---------------- */
  const lineData = [20, 24, 22, 30, 28, 35, 42];
  const barData = [60, 72, 48, 85, 70];

  const badges = ["Verified Brand", "Top Recruiter", "Fast Payout", "Trusted"];

  return (
    <div className="influencer-dashboard">
      <div><BackgroundEffects /></div>
      {/* SIDEBAR (same component) */}
      <Sidebar role="brand" />

      <div className="influencer-main">
        {/* NAVBAR */}
        <nav className={`influencer-navbar ${scrolled ? "scrolled" : ""}`}>
          <div className="nav-left">
            <div className="nav-logo">🏷️</div>
            <div className="nav-brand">CollabAI</div>
          </div>

          <div className="nav-right">
            <div className="dash-sidebar-bottom">
              <div className="dash-cta">Find Matches</div>
            </div>
            <button className="theme-toggle" onClick={toggleTheme}>
              {(document.documentElement.getAttribute("data-theme") || "light") === "dark"
                ? "☀️"
                : "🌙"}
            </button>
            <div className="nav-profile" onClick={logout} style={{ cursor: 'pointer' }} title="Logout">🚪</div>
          </div>
        </nav>

        {/* PROFILE CARD */}
        <section className="profile-card">
          <div className="profile-right">
            <div className="profile-info">
              <div className="profile-photo">🏢</div>
              <div className="profile-meta">
                <div className="profile-name">
                  {data?.name || data?.companyName || "Your Brand"}
                </div>
                <div className="profile-sub">
                  {data?.companyType || "Brand Profile"}
                </div>
              </div>
            </div>
          </div>

          <div className="profile-left">
            <div className="profile-actions">
              <button className="btn-outline">Edit Profile</button>
              <button className="btn-outline">Settings</button>
              <button className="btn-dots">⋯</button>
            </div>
          </div>
        </section>

        {/* ANALYTICS */}
        <main className="analytics-area">
          <div className="analytics-grid">

            {/* CARD 1 — LINE GRAPH */}
            <div className="card neon-card">

              {/* TEXT */}
              <div className="rating-header">
                <div className="rating-main">
                  <div className="rating-label">Total Collaborations</div>
                  <div className="rating-value">
                    {data?.totalCollabs ?? 0}
                  </div>
                </div>
              </div>

              {/* LINE CHART */}
              <div className="line-chart-wrap">
                <LineStatsChart />
              </div>

              {/* DATE RANGE */}
              <div className="chart-range">
                <span>May 2025</span>
                <span>Dec 2025</span>
              </div>

            </div>


            {/* CARD 2 — BAR GRAPH */}
            <div className="card neon-card">
              <div className="card-head">
                <h4>Brand Reach</h4>
                <div className="card-sub">Audience exposure</div>
              </div>

              <div className="line-chart-wrap">
                <BarRankChart />
              </div>
            </div>

            {/* CARD 3 — ACTIVE CAMPAIGNS */}
            <div className="card neon-card">
              <div className="card-head">
                <h4>Active Campaigns</h4>
                <div className="card-sub">Currently running</div>
              </div>
              <div className="card-body center">
                <div className="active-large">4</div>
                <button className="btn-primary">Manage Campaigns</button>
              </div>
            </div>

            {/* CARD 4 — BADGES */}
            <div className="card neon-card">
              <div className="card-head">
                <h4>Brand Badges</h4>
                <div className="card-sub">Achievements</div>
              </div>
              <div className="badges-grid">
                {badges.map((b, i) => (
                  <div className="badge" key={i}>
                    <div className="badge-icon badge-gradient">🏅</div>
                    <div className="badge-name">{b}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
