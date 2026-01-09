import React from "react";
import "../styles/dashboard.css";
import NurotraLogo from "../assets/NurotraLogo.png";
import { NavLink, useNavigate, useLocation, useParams } from "react-router-dom";

export default function Sidebar({ role = "influencer" }) {
  const navigate = useNavigate();
  const location = useLocation();

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
      { id: "dash", label: "Dashboard", icon: "📊", to: "/admin/dashboard" },
      { id: "users", label: "Users", icon: "👥", to: "/admin/users" },
      { id: "settings", label: "Settings", icon: "⚙️", to: "/admin/settings" },
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
    <aside className="dash-sidebar">
      <div
        className="dash-sidebar-top dash-cursor-pointer"
        onClick={() => navigate("/")}
        title="Go to Home"
      >
        <div className="dash-logo-compact"><img src={NurotraLogo} alt="Nurotra Logo" /></div>
        <div className="dash-brand">Nurotra</div>
      </div>

      <nav className="dash-nav">
        {items.map((it) => (
          <NavLink
            key={it.id}
            to={it.to}
            className={({ isActive }) =>
              "dash-nav-item" + (isActive ? " active" : "")
            }
          >
            <span className="dash-icon">{it.icon}</span>
            <span className="dash-label">{it.label}</span>
          </NavLink>
        ))}
      </nav>


    </aside>
  );
}
