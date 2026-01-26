import React from "react";
import "../styles/dashboard.css";
import NurotraLogo from "../assets/NurotraLogo.png";
import { NavLink, useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNuroCore } from "../context/NuroCoreContext";
import "../styles/nuro.css";

export default function Sidebar({ role = "influencer" }) {
  const { memory } = useNuroCore();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  // Detect userId from various possible route patterns
  // Pattern: /influencer/profile/USERID or /influencer/safety/USERID
  const pathParts = location.pathname.split('/');
  const isInfluencerPath = pathParts[1] === 'influencer';
  const isBrandPath = pathParts[1] === 'brand';

  // The userId is usually the 4th part if it exists: /role/section/userId
  const inspectingUserId = pathParts[3];

  let items = [];

  if (role === "admin") {
    items = [
      { id: "influencers", label: "Influencers", icon: "📊", to: "/admin/influencers" },
      { id: "brands", label: "Brands", icon: "🏢", to: "/admin/brands" },
      { id: "analytics", label: "Analytics", icon: "📈", to: "/admin/analytics" },
    ];
  } else {
    // Base items
    const allItems = [
      { id: "profile", label: "Profile", icon: "👤", to: `/${role}/profile` },
      { id: "matching_standards", label: "Matching Standards", icon: "📋", to: `/${role}/matching-standards` },
      { id: "overview", label: "Overview", icon: "📁", to: `/${role}/overview` },
      { id: "collab_insights", label: "Collab Insights", icon: "🔥", to: `/${role}/collab-insights` },
      { id: "history", label: "History", icon: "📜", to: `/${role}/history` },
      { id: "safety_trust", label: "Safety & Trust", icon: "🛡️", to: `/${role}/safety` },
      { id: "deliverables", label: "Deliverables", icon: "📁", to: `/${role}/deliverables` },
      { id: "nuro_lab", label: "Nuro Lab", icon: "🧪", to: "/nuro-lab" },
    ];

    if (inspectingUserId) {
      // Filter for permitted sections only
      const permittedIds = ["profile", "matching_standards", "safety_trust", "deliverables"];
      items = allItems
        .filter(it => permittedIds.includes(it.id))
        .map(it => ({
          ...it,
          to: `${it.to}/${inspectingUserId}`
        }));
    } else {
      items = allItems;
    }
  }

  return (
    <>
      {/* Mobile Menu Trigger (Hamburger) - Visible only on Mobile */}
      <button
        className="mobile-menu-trigger-btn"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open Menu"
      >
        ☰
      </button>

      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Sidebar Drawer */}
      {/* Sidebar Drawer */}
      <aside className={`dash-sidebar ${isMobileOpen ? 'active' : ''}`}>
        {/* Mobile Header */}
        <div className="dash-sidebar-header-mobile">
          <div
            className="mobile-header-brand dash-cursor-pointer"
            onClick={() => {
              navigate("/");
              setIsMobileOpen(false);
            }}
          >
            <div className="dash-logo-compact"><img src={NurotraLogo} alt="Nurotra Logo" /></div>
            <div className="dash-brand">Nurotra</div>
          </div>
          <button className="close-sidebar-btn" onClick={() => setIsMobileOpen(false)}>✕</button>
        </div>

        {/* Desktop Header (Restored) */}
        <div className="dash-sidebar-top mobile-hidden">
          <div className="dash-logo-compact cursor-pointer" onClick={() => navigate("/")}>
            <img src={NurotraLogo} alt="Nurotra Logo" />
          </div>
          <div className="dash-brand cursor-pointer" onClick={() => navigate("/")}>
            {role === "admin" ? "Admin Control Room" : "Nurotra"}
          </div>
        </div>

        <nav className="dash-nav">
          {items.map((it) => (
            <NavLink
              key={it.id}
              to={it.to}
              onClick={() => setIsMobileOpen(false)} // Auto close on mobile nav
              className={({ isActive }) =>
                "dash-nav-item" + (isActive ? " active" : "")
              }
            >
              <span className="dash-icon">
                {it.icon}
                {/* Notification dot for unexplored features */}
                {memory?.seenGuides && !memory.seenGuides.includes(`${it.id}_guide`) && (
                  <span className="glowing-dot sidebar-dot"></span>
                )}
              </span>
              <span className="dash-label">{it.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
