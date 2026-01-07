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

            {/* Theme Toggle Button (Top Right) */}
            <div className="profile-theme-toggle-wrapper">
                <button
                    className="theme-toggle profile-theme-toggle-btn"
                    onClick={toggleTheme}
                    title="Toggle Theme"
                >
                    {theme === "light" ? "🌙" : "☀️"}
                </button>
            </div>

            <div className="profile-card-wrapper">
                <div className="profile-header">
                    <div className="profile-avatar-large">
                        {user.profileImg ? <img src={user.profileImg} alt="Profile" /> : "👤"}
                    </div>
                    <h1>{user.name}</h1>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                        <span className="profile-role-badge">{user.role?.toUpperCase()}</span>
                        {deliverablesCount > 0 && (
                            <span className="profile-role-badge" style={{ background: 'rgba(74, 144, 226, 0.2)', border: '1px solid #4A90E2', color: '#4A90E2' }}>
                                ✅ {deliverablesCount} PROVEN
                            </span>
                        )}
                    </div>
                </div>

                <div className="profile-details">
                    <div className="detail-item">
                        <label>Nuro ID</label>
                        <div className="unique-id-box">{user.uniqueId || user._id}</div>
                        <small className="id-hint">Share this Nuro ID with brands/influencers to connect.</small>
                    </div>

                    <div className="detail-item">
                        <label>Email</label>
                        <div className="detail-value">{user.email}</div>
                    </div>

                    <div className="detail-item">
                        <label>Account Status</label>
                        <div className="detail-value status-active">Active</div>
                    </div>
                </div>

                {/* 3. PROFILE ACTIONS (Footer) */}
                <div className="profile-actions-footer">
                    <button className="btn-secondary" onClick={() => navigate(-1)}>Back</button>
                    <button className="btn-danger" onClick={handleLogout}>Logout</button>
                </div>
            </div>

            {/* NURO LAB INTEGRATION */}
            <button
                className="lab-toggle-btn"
                onClick={() => setLabOpen(true)}
                title="Open Nuro Lab"
            >
                🧪
            </button>
            <NuroLab isOpen={isLabOpen} toggleLab={() => setLabOpen(false)} />
        </div>
    );
}
