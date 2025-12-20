// src/pages/brand/brandDashboard.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import "../../styles/dashboard.css";
import LineStatsChart from "../../components/charts/LineStatsChart";
import BarRankChart from "../../components/charts/BarRankChart";
import BackgroundEffects from "../../components/BackgroundEffects";
import { useNavigate } from "react-router-dom";
import { profileService, matchService } from "../../services/apiService"; // Import matchService
import BrandMatchResults from "./BrandMatchResults"; // Import Match Results Overlay
import LeafTransition from "../../components/LeafTransition"; // Import Animation

export default function BrandDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Direct matching states
  const [matches, setMatches] = useState(null);
  const [findingMatches, setFindingMatches] = useState(false);
  const [showTransition, setShowTransition] = useState(false);

  // Fetch Real Profile Data
  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.token) {
        try {
          const data = await profileService.getBrand(user.token);
          setProfile(data);
        } catch (err) {
          console.error("Failed to fetch brand profile", err);
        }
      }
    };
    fetchProfile();
  }, [user]);

  // Use Profile Data or Default to User Context
  const data = profile || user || {};

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

  /* ---------------- FIND MATCH ACTION ---------------- */
  const handleFindMatches = async () => {
    // SMART MATCH LOGIC
    // If profile exists and has key "Standards" like industry, we match directly.
    // Otherwise, we send them to the form.
    // If profile exists (even partially), we match directly.
    // Explicitly check if profile is not null/empty
    if (profile && Object.keys(profile).length > 0) {
      // Trigger Animation FIRST
      setShowTransition(true);
    } else {
      // First time or incomplete -> Go to Form
      navigate("/brand/matching");
    }
  };

  const handleTransitionComplete = async () => {
    // Hidden internal function to actually fetch data after animation
    setShowTransition(false);
    setFindingMatches(true);
    try {
      const results = await matchService.getBrandMatches(user.uniqueId || "BRAND-TEMP");
      // Navigate to Results Page with Data
      navigate("/match-results", { state: { matches: results, role: 'brand' } });
    } catch (err) {
      console.error("Match failed", err);
    } finally {
      setFindingMatches(false);
    }
  };

  const closeMatches = () => {
    setMatches(null);
  };

  /* ---------------- MOCK ANALYTICS ---------------- */
  const lineData = [20, 24, 22, 30, 28, 35, 42];
  const barData = [60, 72, 48, 85, 70];

  const badges = ["Verified Brand", "Top Recruiter", "Fast Payout", "Trusted"];

  return (
    <div className="influencer-dashboard">
      <div><BackgroundEffects /></div>

      {/* MATCH RESULTS OVERLAY (Direct access) - REMOVED */}
      {/* {matches && <BrandMatchResults matches={matches} onClose={closeMatches} />} */}

      {/* TRANSITION ANIMATION */}
      <LeafTransition isActive={showTransition} onComplete={handleTransitionComplete} />

      {/* SIDEBAR (same component) */}
      <Sidebar role="brand" />

      <div className="influencer-main">
        {/* NAVBAR */}
        <nav className={`influencer-navbar ${scrolled ? "scrolled" : ""}`}>
          <div className="nav-left">
            <div className="nav-brand">Collaborator</div>
          </div>

          <div className="nav-right">
            <div className="dash-sidebar-bottom">
              <div
                className="dash-cta dash-cursor-pointer"
                onClick={handleFindMatches}
                style={{ opacity: findingMatches ? 0.7 : 1, cursor: findingMatches ? 'wait' : 'pointer' }}
              >
                {findingMatches ? "Finding..." : "Find Matches"}
              </div>
            </div>
            <button className="theme-toggle" onClick={toggleTheme}>
              {(document.documentElement.getAttribute("data-theme") || "light") === "dark"
                ? "☀️"
                : "🌙"}
            </button>
            <div
              className="nav-profile-icon"
              onClick={() => setShowModal(true)}
              title="View Profile"
            >
              {data?.profileImg ? (
                <img src={data.profileImg} alt="Profile" className="nav-profile-img-inner" />
              ) : (
                <div className="nav-profile-placeholder">🏢</div>
              )}
            </div>
          </div>
        </nav>

        {/* PROFILE MODAL */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowModal(false)} className="modal-close-btn">×</button>

              <div className="modal-header-center">
                <div className="modal-profile-img-container">
                  {data?.profileImg ? <img src={data.profileImg} className="nav-profile-img-inner" /> : <div className="modal-profile-placeholder"></div>}
                </div>
                <h2>{data?.userId?.name || "Brand Name"}</h2>
                <p className="text-muted-custom">{data?.companyType} • {data?.industry}</p>
              </div>

              <div className="modal-details-grid">
                <div className="modal-info-row">
                  <strong>Website:</strong> <a href={data?.website} target="_blank" rel="noreferrer" className="text-accent-1">{data?.website}</a>
                </div>
                <div className="modal-info-row">
                  <strong>Content Type:</strong> {data?.contentType}
                </div>
                <div className="modal-info-row">
                  <strong>Budget:</strong> {data?.budget}
                </div>
                <div className="modal-info-row">
                  <strong>Contact:</strong> {data?.contact}
                </div>
              </div>

              <button onClick={logout} className="modal-logout-btn">
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* PROFILE CARD (Main Dashboard View) */}
        <section className="profile-card">
          <div className="profile-right">
            <div className="profile-info">
              <div className="profile-photo">
                {data?.profileImg ? <img src={data.profileImg} className="brand-dash-profile-img" /> : "🏢"}
              </div>
              <div className="profile-meta">
                <div className="profile-name">
                  {data?.userId?.name || "Your Brand"}
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
