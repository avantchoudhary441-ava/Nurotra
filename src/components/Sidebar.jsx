// src/components/Sidebar.jsx
import React from "react";
import "../styles/dashboard.css";
import { NavLink } from "react-router-dom";

export default function Sidebar({ role = "influencer" }) {
  // icon set (Icon B style: simple round glyphs)
  const items = [
    { id: "profile", label: "Profile", icon: "👤", to: `/${role}/profile` },
    { id: "past", label: "Past Collab", icon: "📁", to: `/${role}/past` },
    { id: "active", label: "Active", icon: "🔥", to: `/${role}/active` },
    { id: "badges", label: "Badges", icon: "🏅", to: `/${role}/badges` },
  ];

  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar-top">
        <div className="dash-logo-compact">🤝</div>
        <div className="dash-brand">CollabAI</div>
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

      <div className="dash-sidebar-bottom">
        <div className="dash-cta">Find Matches</div>
      </div>
    </aside>
  );
}
