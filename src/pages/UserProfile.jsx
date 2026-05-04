import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/userProfile.css";
import BackgroundEffects from "../components/BackgroundEffects";
import CurrencySelector from "../components/CurrencySelector";
import api from "../services/apiService";

export default function UserProfile() {
    const { user, logout, updateUser } = useAuth();
    const navigate = useNavigate();


    // Theme Toggle Logic
    const [theme, setTheme] = React.useState(localStorage.getItem("theme") || "light");





    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
    };

    const [uploading, setUploading] = useState(false);

    if (!user) {
        return (
            <div className="profile-container profile-login-warning">
                <h2>Please log in to view your profile.</h2>
                <button className="btn-primary" onClick={() => navigate("/login")}>Login</button>
            </div>
        );
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", file);

            // 1. Upload to Cloudinary
            const uploadRes = await api.post("/upload", formData);

            if (uploadRes.data && uploadRes.data.url) {
                const newUrl = uploadRes.data.url;

                // 2. Sync to Backend (User AND Profile models)
                // We can use the existing saveInfluencer/saveBrand logic or a dedicated user update
                // Given the backend sync I just added, saving via the appropriate profile route will sync to User.
                if (user.role === 'influencer') {
                    await api.post("/influencer", { profileImg: newUrl });
                } else if (user.role === 'brand') {
                    await api.post("/brand", { profileImg: newUrl });
                }

                // 3. Update local context
                updateUser({ profileImg: newUrl });
                alert("Profile photo updated!");
            }
        } catch (err) {
            console.error("Failed to upload profile photo", err);
            alert("Failed to upload photo. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div className="profile-container">
            <BackgroundEffects />

            {/* Top Right Controls */}
            <div className="profile-theme-toggle-wrapper">

                <CurrencySelector />
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
                    <div className={`profile-avatar-large ${!user.profileImg ? "placeholder" : ""} ${uploading ? "uploading" : ""}`}>
                        {user.profileImg ? (
                            <img src={user.profileImg} alt={user.name} />
                        ) : (
                            "👤"
                        )}

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            id="avatar-upload"
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                            disabled={uploading}
                        />

                        {/* Overlay Trigger */}
                        <label htmlFor="avatar-upload" className="profile-photo-edit-overlay">
                            {uploading ? "..." : "📷"}
                        </label>
                    </div>

                    <h1>{user.name}</h1>
                </div>

                <div className="profile-details">
                    <div className="detail-item">
                        <label>Nuro ID</label>
                        <span className="unique-id-value">{user.uniqueId || user._id?.substring(0, 12) || "N/A"}</span>
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


        </div>
    );
}
