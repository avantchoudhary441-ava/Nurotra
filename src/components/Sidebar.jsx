// src/components/Sidebar.jsx
import React from "react";
import "../styles/dashboard.css";
import NurotraLogo from "../assets/NurotraLogo.png";
import { NavLink } from "react-router-dom";

export default function Sidebar({ role = "influencer" }) {
  // icon set (Icon B style: simple round glyphs)
  const items = [
  { id: "profile", label: "Profile", icon: "👤", to: `/${role}/profile` },

  { id: "overview", label: "Overview", icon: "📁", to: `/${role}/overview` },

  { id: "collab_insights", label: "Collab Insights", icon: "🔥", to: `/${role}/collab-insights` },

  { id: "history", label: "History", icon: "📜", to: `/${role}/history` },

  { id: "safety_trust", label: "Safety & Trust", icon: "🛡️", to: `/${role}/safety` },
];


  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar-top">
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
