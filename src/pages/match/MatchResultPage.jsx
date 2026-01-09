import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion"; // Added import
import "../../styles/matchResult.css";
import logo from "../../assets/NurotraLogo.png";
import BackgroundEffects from "../../components/BackgroundEffects";
import { chatService } from "../../services/apiService";

export default function MatchResultPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { matches = [], role } = location.state || { matches: [], role: "influencer" };

    // Theme State (Sync with localStorage)
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    // Scroll State for Header
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Top 3 Matches
    const topMatches = matches.slice(0, 3);

    // Animations
    const titleVariants = {
        hidden: { opacity: 0, scale: 0.8, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.8 } }
    };
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.3, delayChildren: 0.6 } }
    };
    const cardVariants = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80 } }
    };

    const handleConnect = async (matchItem) => {
        try {
            // Unify ID extraction
            const targetUserId = matchItem.userId || matchItem.user?._id || matchItem._id;

            if (!targetUserId) {
                console.error("No User ID to connect");
                return;
            }
            // Create/Access Chat
            await chatService.accessChat(targetUserId);

            // Navigate with AI Context State
            navigate("/chat", {
                state: {
                    startNegotiation: true,
                    matchContext: {
                        name: matchItem.user?.name || matchItem.companyName,
                        niche: matchItem.niche || matchItem.industry,
                        matchScore: matchItem.matchScore,
                        focus: matchItem.focus || "Collaboration"
                    }
                }
            });
        } catch (error) {
            console.error("Connect failed", error);
            // Optionally show toast
        }
    };

    return (
        <div className="match-result-container">
            {/* Reused Background Grid/Effects */}
            <BackgroundEffects />
            <div className="inf-glow"></div>


            {/* HEADER */}
            <header className={`match-header ${scrolled ? "scrolled" : ""}`}>
                {/* Left: Logo + Text */}
                <div className="header-left" onClick={() => navigate(-1)}>
                    <img src={logo} alt="Logo" className="brand-logo" />
                    {/* Plain text color matching main landing page (white/theme text) */}
                    <span className="brand-name">Nurotra</span>
                </div>

                {/* Center: REMOVED as requested */}
                <div className="header-center"></div>

                {/* Right: Toggle */}
                <div className="header-right">
                    <button className="theme-btn-minimal" onClick={toggleTheme}>
                        {theme === "dark" ? "☀️" : "🌙"}
                    </button>
                </div>
            </header>

            {/* MATCH CONTENT */}
            <main className="match-hero">
                <motion.div
                    className="hero-title-wrap"
                    variants={titleVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <h1 className="hero-title">Perfect Match Results</h1>
                </motion.div>

                <motion.div
                    className="pyramid-container"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {topMatches.map((match, i) => {
                        // Calculate percentage label. Backend provides 'matchScore' (0-100 or 0-1)
                        const rawScore = match.matchScore;
                        let displayScore = "N/A";

                        if (rawScore !== undefined && rawScore !== null) {
                            const num = parseFloat(rawScore);
                            if (!isNaN(num)) {
                                // specific heuristic: if <= 1, treat as ratio (0.95 -> 95%). else as percent (95 -> 95%).
                                displayScore = num <= 1 ? `${Math.round(num * 100)}%` : `${Math.round(num)}%`;
                            } else {
                                displayScore = rawScore;
                            }
                        }

                        const scoreLabel = `Match Accuracy - ${displayScore}`;

                        return (
                            <motion.div key={i} className="card-wrapper" variants={cardVariants}>
                                <div className="premium-card">
                                    <img
                                        src={match.user?.profileImg || logo}
                                        alt={match.user?.name || "User"}
                                        className="card-avatar"
                                    />
                                    {/* Name of the user - Robust Fallback */}
                                    <h3 className="card-name">{match.user?.name || match.companyName || "N/A"}</h3>

                                    {/* Match Accuracy (Gradient + Glowing) */}
                                    <div className="card-match-score ">{scoreLabel}</div>

                                    <div className="card-meta">
                                        {/* INFLUENCER DETAILS (If User is Brand looking for Influencers) */}
                                        {role === 'brand' && (
                                            <>
                                                <MetaRow label="Niche" value={match.niche} />
                                                <MetaRow label="Followers" value={match.followers} />
                                                <MetaRow label="Engagement Rate" value={match.engagementRate ? `${match.engagementRate}%` : null} />
                                                <MetaRow label="Budget" value={match.budget} />
                                            </>
                                        )}

                                        {/* BRAND DETAILS (If User is Influencer looking for Brands) */}
                                        {role === 'influencer' && (
                                            <>
                                                <MetaRow label="Niche" value={match.industry || match.niche} />
                                                {/* Handle Array or String for Content */}
                                                <MetaRow label="Preferred Content" value={match.contentType || (match.contentTypes?.join(", "))} />
                                                <MetaRow label="Req. Engagement" value={match.minEngagement} />
                                                <MetaRow label="Budget" value={match.budget} />
                                            </>
                                        )}
                                    </div>

                                    {/* ACTION BUTTONS ROW */}
                                    <div className="card-actions-row">
                                        <button
                                            className="connect-btn"
                                            onClick={() => handleConnect(match)}
                                        >
                                            Connect 💬
                                        </button>

                                        {/* Inspact Button (Glassy, Shows on Hover) */}
                                        <button
                                            className="inspact-btn"
                                            title="Inspect Nurotra Profile"
                                            onClick={() => {
                                                const targetUserId = match.userId || match.user?._id || match._id;
                                                const targetRole = role === 'brand' ? 'influencer' : 'brand';
                                                if (targetUserId) {
                                                    navigate(`/${targetRole}/profile/${targetUserId}`);
                                                } else {
                                                    console.warn("Inspact: Missing User ID", match);
                                                }
                                            }}
                                        >
                                            Inspact 👁️
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </main>
        </div>
    );
}

// Meta Row Helper with White Glow logic
function MetaRow({ label, value }) {
    return (
        <div className="meta-row white-glow-text">
            <span className="meta-label">{label}:</span>
            <span className="meta-value">{value || "N/A"}</span>
        </div>
    );
}
