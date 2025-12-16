import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/userProfile.css";
import BackgroundEffects from "../components/BackgroundEffects";

export default function UserProfile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Theme Toggle Logic
    const [theme, setTheme] = React.useState(localStorage.getItem("theme") || "light");

    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
    };

    if (!user) {
        return (
            <div className="profile-container" style={{ textAlign: "center", paddingTop: "5rem", color: "white" }}>
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
            <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 20 }}>
                <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        padding: '0.5rem',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px'
                    }}
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
                    <span className="profile-role-badge">{user.role?.toUpperCase()}</span>
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
                        <div className="detail-value" style={{ color: '#4ade80' }}>Active</div>
                    </div>
                </div>

                <div className="profile-actions-footer">
                    <button className="btn-secondary" onClick={() => navigate(-1)}>Back</button>
                    <button className="btn-danger" onClick={handleLogout}>Logout</button>
                </div>
            </div>
        </div>
    );
}
