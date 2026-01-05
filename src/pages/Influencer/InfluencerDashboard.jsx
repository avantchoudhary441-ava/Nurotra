import React, { useEffect, useState, Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import "../../styles/dashboard.css";
import BackgroundEffects from "../../components/BackgroundEffects";
import LineStatsChart from "../../components/charts/LineStatsChart";
import BarRankChart from "../../components/charts/BarRankChart";
import { profileService, matchService } from "../../services/apiService";
import InfluencerMatchResults from "./InfluencerMatchResults";
import LeafTransition from "../../components/LeafTransition";
import ErrorBoundary from "../../components/ErrorBoundary";

// Lazy Load the AI Studio to save initial bandwidth
const ProfileEnhancer = React.lazy(() => import("../../components/ProfileEnhancer"));

export default function InfluencerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEnhancer, setShowEnhancer] = useState(false); // Enhancer State

  // Direct matching states
  const [matches, setMatches] = useState(null);
  const [findingMatches, setFindingMatches] = useState(false);
  const [showTransition, setShowTransition] = useState(false);

  // Fetch Real Profile Data
  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.token) {
        try {
          const data = await profileService.getInfluencer(user.token);
          setProfile(data);
        } catch (err) {
          console.error("Failed to fetch influencer profile", err);
        }
      }
    };
    fetchProfile();
  }, [user]);

  // Use user context data, fallback to defaults if needed
  const data = profile || user || {};

  // UI state
  const [scrolled, setScrolled] = useState(false);

  // scroll handler for navbar glass effect
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 18);
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------------- FIND MATCH ACTION ---------------- */
  const handleFindMatches = async () => {
    // SMART MATCH LOGIC
    if (profile && Object.keys(profile).length > 0) {
      // Trigger Animation FIRST
      setShowTransition(true);
    } else {
      navigate("/influencer/matching");
    }
  };

  const handleTransitionComplete = async () => {
    setShowTransition(false);
    setFindingMatches(true);
    try {
      const results = await matchService.getInfluencerMatches(user.uniqueId || "INF-TEMP");
      navigate("/match-results", { state: { matches: results, role: 'influencer' } });
    } catch (err) {
      console.error("Match failed", err);
    } finally {
      setFindingMatches(false);
    }
  };

  const closeMatches = () => {
    setMatches(null);
  };

  // Helpers
  const followerCategory = () => {
    if (!data) return "Beginner";
    const f = data.followers || "";
    if (f.includes("100k")) return "Expert";
    if (f.includes("50k")) return "Expert";
    if (f.includes("10k")) return "Intermediate";
    return "Beginner";
  };

  const activeCount = data?.activeCount ?? 3;
  const badges = [
    { id: 1, name: "Creator Pro", color: "gold" },
    { id: 2, name: "Top 10%", color: "silver" },
    { id: 3, name: "Engagement Star", color: "gradient" },
    { id: 4, name: "Verified", color: "blue" },
    { id: 5, name: "Fast Responder", color: "purple" },
    { id: 6, name: "Brand Friendly", color: "teal" },
  ];

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const onThreeDots = () => {
    // Placeholder for profile options: View analytics / Export profile / Share link
  };

  return (
    <div className="influencer-dashboard">
      <div><BackgroundEffects /></div>

      {/* MATCH RESULTS OVERLAY */}
      {/* {matches && <InfluencerMatchResults matches={matches} onClose={closeMatches} />} */}

      {/* PROFILE ENHANCER STUDIO with Safety Net */}
      {/* PROFILE ENHANCER STUDIO with Safety Net & Lazy Loading */}
      {showEnhancer && (
        <ErrorBoundary>
          <Suspense fallback={<div className="modal-overlay"><div className="spinner"></div></div>}>
            <ProfileEnhancer
              profileData={profile || user}
              onClose={() => setShowEnhancer(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* TRANSITION ANIMATION */}
      <LeafTransition isActive={showTransition} onComplete={handleTransitionComplete} />

      {/* Sidebar */}
      <Sidebar role="influencer" />

      {/* Page content */}
      <div className="influencer-main">
        {/* Top navbar */}

        {/* (Navbar code remains same) ... */}
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
            <button
              id="theme-toggle"
              className="theme-toggle"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            >
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
                <div className="nav-profile-placeholder">👤</div>
              )}
            </div>
          </div>
        </nav>

        {/* PROFILE MODAL (Existing) */}
        {showModal && (
          // ... (Modal code) ...
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            {/* ... */}
          </div>
        )}

        {/* Horizontal profile card */}
        <section className="profile-card">
          {/* RIGHT SIDE (now left) - profile image + name */}
          <div className="profile-right">
            <div className="profile-info">
              <div className="profile-photo">
                {data?.profileImg ? <img src={data.profileImg} alt="profile" /> : <span>👤</span>}
              </div>

              <div className="profile-meta">
                <div className="profile-name">{data?.userId?.name || "Anonymous"}</div>
                <div className="profile-sub">{followerCategory()}</div>
              </div>
            </div>
          </div>

          {/* LEFT SIDE (now right) - action buttons */}
          <div className="profile-left">
            <div className="profile-actions">
              {/* ✨ AI ENHANCE BUTTON */}
              <button
                className="btn-primary-gradient"
                onClick={() => setShowEnhancer(true)}
                style={{ marginRight: '10px' }}
              >
                <span>✨</span> Enhance Profile
              </button>

              <button className="btn-outline" onClick={() => navigate("/influencer/profile")}>Edit Profile</button>
              <button className="btn-outline" onClick={() => navigate("/influencer/settings")}>Settings</button>
              <button className="btn-dots" onClick={onThreeDots}>⋯</button>
            </div>
          </div>
        </section>

        {/* Main analytics grid */}
        {/* ... */}

        {/* Main analytics grid */}
        <main className="analytics-area">
          <div className="analytics-grid">
            {/* Card 1: Total Collaborations + small bar chart */}
            {/* Card 1: Total Collaborations (clean & minimal) */}
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


            {/* Card 2: Top X% circular progress */}
            <div className="card neon-card">
              <div className="card-head">
                <h4>Top</h4>
                <div className="card-sub">Audience exposure</div>
              </div>

              <div className="line-chart-wrap">
                <BarRankChart />
              </div>
            </div>

            {/* Card 3: Active collaborations */}
            <div className="card neon-card">
              <div className="card-head">
                <h4>Active Collaborations</h4>
                <div className="card-sub">Currently running</div>
              </div>

              <div className="card-body">
                <div className="active-large">{activeCount}</div>
                <div className="active-actions">
                  <button className="btn-primary">View Active</button>
                  <button className="btn-secondary">Manage</button>
                </div>
              </div>
            </div>

            {/* Card 4: Badges */}
            <div className="card neon-card">
              <div className="card-head">
                <h4>Badges</h4>
                <div className="card-sub">Achievements</div>
              </div>

              <div className="card-body badges-grid">
                {badges.map((b) => (
                  <div className="badge" key={b.id}>
                    <div className={`badge-icon ${b.color === "gradient" ? "badge-gradient" : ""}`}>
                      🏅
                    </div>
                    <div className="badge-name">{b.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

      </div>

      {/* FLOATING CHAT BUTTON */}
      <button
        onClick={() => navigate('/chat')}
        className="floating-chat-btn"
        title="Open Chat Inbox"
      >
        <MessageCircle size={28} />
      </button>

    </div>
  );
}

/* --------------------------
   Circular progress as component
   -------------------------- */
function CircularProgress({ percent = 50, label = "Top 50%" }) {
  // Clamp percent
  const p = Math.max(0, Math.min(100, percent));
  const radius = 48;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (p / 100) * circumference;

  return (
    <div className="circular-wrap">
      <svg height={radius * 2} width={radius * 2} className="circular-svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(99,102,241)" />
            <stop offset="100%" stopColor="rgb(168,85,247)" />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          stroke="rgba(255,255,255,0.06)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Foreground progress */}
        <circle
          stroke="url(#grad1)"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="circular-progress-svg-circle"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          transform={`rotate(-90 ${radius} ${radius})`}
        />
      </svg>

      <div className="circular-label">
        <div className="circular-number">{percent}%</div>
        <div className="circular-text">{label}</div>
      </div>
    </div>
  );
}
