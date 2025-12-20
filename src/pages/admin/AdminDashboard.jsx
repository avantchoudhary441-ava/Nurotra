import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import "../../styles/dashboard.css";
import BackgroundEffects from "../../components/BackgroundEffects";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const stats = [
        { title: "Total Users", value: "128", cssClass: "stat-primary" },
        { title: "Active Brands", value: "45", cssClass: "stat-success" },
        { title: "Influencers", value: "83", cssClass: "stat-purple" },
        { title: "Pending", value: "12", cssClass: "stat-warning" },
    ];

    return (
        <div className="influencer-dashboard">
            <BackgroundEffects />
            <Sidebar role="admin" />

            <div className="influencer-main">
                {/* Navbar */}
                <nav className={`influencer-navbar ${scrolled ? "scrolled" : ""}`}>
                    <div className="nav-left">
                        <div className="nav-brand">Nurotra Admin</div>
                    </div>
                    <div className="nav-right">
                        <div className="nav-profile dash-cursor-pointer" onClick={logout} title="Logout">🚪</div>
                    </div>
                </nav>

                {/* Content */}
                <div className="analytics-area admin-content">

                    {/* Stats Grid */}
                    <div className="analytics-grid admin-stats-grid">
                        {stats.map((s, i) => (
                            <div key={i} className={`card neon-card ${s.cssClass}`}>
                                <div className="card-head">
                                    <h4>{s.title}</h4>
                                </div>
                                <div className="rating-value admin-stat-value">
                                    {s.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions / Recent */}
                    <div className="card neon-card mt-2rem">
                        <div className="card-head">
                            <h4>Recent Activity</h4>
                        </div>
                        <div className="card-body">
                            <p className="text-gray">User management table coming soon...</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
