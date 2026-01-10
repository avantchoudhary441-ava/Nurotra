import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import "../styles/dashboard.css"; // Reuse dashboard styles + new mobile nav styles

export default function MobileNav({ role = "influencer" }) {
    const navigate = useNavigate();
    const location = useLocation();

    // Detect userId from various possible route patterns
    const pathParts = location.pathname.split('/');

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
        <div className="mobile-nav-container">
            <div className="mobile-nav-scroll">
                {items.map((it) => (
                    <NavLink
                        key={it.id}
                        to={it.to}
                        className={({ isActive }) =>
                            "mobile-nav-card" + (isActive ? " active" : "")
                        }
                    >
                        <span className="mobile-nav-icon">{it.icon}</span>
                        <span className="mobile-nav-label">{it.label}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
}
