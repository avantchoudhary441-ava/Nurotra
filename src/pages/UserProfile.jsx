import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/userProfile.css";
import BackgroundEffects from "../components/BackgroundEffects";
import NuroLab from "../components/Nuro/NuroLab";
import api from "../services/apiService";

export default function UserProfile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isLabOpen, setLabOpen] = useState(false);
    const [deliverablesCount, setDeliverablesCount] = useState(0);

    // Theme Toggle Logic
    const [theme, setTheme] = React.useState(localStorage.getItem("theme") || "light");

    React.useEffect(() => {
        if (user) {
            fetchDeliverablesCount();
        }
    }, [user]);

    const fetchDeliverablesCount = async () => {
        try {
            const res = await api.get("/deliverables");
            setDeliverablesCount(Array.isArray(res.data) ? res.data.length : 0);
        } catch (err) {
            console.error("Error fetching deliverables count", err);
        }
    };

    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
    };

    if (!user) {
        return (
            <div className="profile-container profile-login-warning">
                <h2>Please log in to view your profile.</h2>
                <button className="btn-primary" onClick={() => navigate("/login")}>Login</button>
            </div>
        );
    }

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div className="profile-container">
            <BackgroundEffects />

            {/* Top Right Controls */}
            <div className="profile-theme-toggle-wrapper">
                <button
                    className="icon-btn-floating"
                    onClick={() => setLabOpen(true)}
                    title="Open Nuro Lab"
                >
                    🧪
                </button>
                <button
                    className="icon-btn-floating"
                    onClick={toggleTheme}
                    title="Toggle Theme"
                >
                    {theme === "light" ? "🌙" : "☀️"}
                </button>
            </div>

            <div className="profile-card-wrapper">
                <div className="profile-header">
                    <div className={user.profileImg ? "profile-avatar-large" : "profile-avatar-large placeholder"}>
                        {user.profileImg ? (
                            <img src={user.profileImg} alt={user.name} />
                        ) : (
                            "👤"
                        )}
                    </div>

                    <h1>{user.name}</h1>

                    {/* Role & Status Badges */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
                        <span className="profile-role-badge">
                            {user.role || "USER"}
                        </span>
                        {deliverablesCount > 0 && (
                            <span className="profile-role-badge" style={{ borderColor: '#4ade80', color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)' }}>
                                ✅ {deliverablesCount} PROVEN
                            </span>
                        )}
                    </div>
                </div>

                <div className="profile-details">
                    <div className="detail-item">
                        <label>Nuro ID</label>
                        <span className="unique-id-value">{user.uniqueId || user._id.substring(0, 12)}</span>
                    </div>

                    <div className="detail-item">
                        <label>Email</label>
                        <span className="detail-value">{user.email}</span>
                    </div>

                    <div className="detail-item">
                        <label>Status</label>
                        <span className="detail-value status-active">Active</span>
                    </div>

                    <div className="detail-item">
                        <label>Joined</label>
                        <span className="detail-value">{new Date(user.createdAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="profile-actions-footer">
                    <button className="btn-secondary" onClick={() => navigate(-1)}>
                        Back
                    </button>
                    <button className="btn-danger" onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            </div>

            <NuroLab isOpen={isLabOpen} toggleLab={() => setLabOpen(false)} />
        </div>
    );
}
