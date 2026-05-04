import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "../../styles/matchResult.css";
import logo from "../../assets/NurotraLogo.png";
import BackgroundEffects from "../../components/BackgroundEffects";
import { chatService } from "../../services/apiService";
import CurrencySelector from "../../components/CurrencySelector";
import LockedMatchCard from "../../components/match/LockedMatchCard";
import UnlockMatchModal from "../../components/modals/UnlockMatchModal";
import { useCurrency } from "../../context/CurrencyContext";

export default function MatchResultPage() {
    const { currency } = useCurrency();
    const location = useLocation();
    const navigate = useNavigate();
    const { matches = [], role } = location.state || { matches: [], role: "influencer" };

    // Theme State (Sync with localStorage)
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

    // Unlock Modal State
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [pendingUnlockIndex, setPendingUnlockIndex] = useState(null);
    const [unlockedIndices, setUnlockedIndices] = useState([]);

    // Role-based card limiting:
    // Influencer: 2 total (1 unlocked, 1 locked)
    // Brand: 3 total (2 unlocked, 1 locked)
    const unlockedCount = role === 'brand' ? 2 : 1;
    const totalVisibleCount = role === 'brand' ? 3 : 2;

    // Helper to process budget strings (e.g., "₹10,000 - ₹50,000")
    const processBudget = (budgetStr) => {
        if (!budgetStr) return "N/A";
        // Swap all currency symbols to match current toggle
        return budgetStr.replace(/[₹$£€¥د.إR$₽A$C$]/g, currency);
    };

    // --- PAD MATCHES IF INSUFFICIENT ---
    const generateDummyMatch = (index) => ({
        _id: `dummy-${index}`,
        user: {
            name: "Exclusive Partner",
            profileImg: null
        },
        companyName: "Premium Brand",
        niche: "Various",
        matchScore: 0.98,
        matchExplanation: "High potential match based on your profile.",
        budget: `${currency}10,000 - ${currency}50,000`,
        industry: "Lifestyle & Tech",
        minEngagement: "2.5%",
        contentType: ["Reels", "Stories"]
    });

    let displayMatches = [...matches];

    if (displayMatches.length < totalVisibleCount) {
        const needed = totalVisibleCount - displayMatches.length;
        for (let i = 0; i < needed; i++) {
            displayMatches.push(generateDummyMatch(i));
        }
    }

    const visibleMatches = displayMatches.slice(0, totalVisibleCount);
    // -----------------------------------

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

    // Handle locked card click
    const handleLockedCardClick = (index) => {
        setPendingUnlockIndex(index);
        setShowUnlockModal(true);
    };

    // Handle unlock after modal flow
    const handleUnlock = () => {
        if (pendingUnlockIndex !== null) {
            setUnlockedIndices(prev => [...prev, pendingUnlockIndex]);
        }
        setPendingUnlockIndex(null);
    };

    // Check if a card at index is locked
    const isCardLocked = (index) => {
        return index >= unlockedCount && !unlockedIndices.includes(index);
    };

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CurrencySelector />
                        <button className="theme-btn-minimal" onClick={toggleTheme}>
                            {theme === 'light' ? '🌙' : '☀️'}
                        </button>
                    </div>
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
                    {matches.length === 0 ? (
                        <div className="exhaustion-container">
                            <motion.div
                                className="exhaustion-card"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <div className="exhaustion-icon">🌌</div>
                                <h2>No More Matches Found</h2>
                                <p>You have reviewed all available profiles for now.</p>
                                <div className="nuro-note">
                                    <strong>Guardian Note:</strong> Nuro is scanning for new partners as they join.
                                    Try refining your search criteria or checking back in a few hours.
                                </div>
                                <button className="reset-search-btn" onClick={() => navigate(-1)}>
                                    Refresh Search 🔄
                                </button>
                            </motion.div>
                        </div>
                    ) : (
                        visibleMatches.map((match, i) => {
                            // Check if this card should be locked
                            const locked = isCardLocked(i);
                            const rawScore = match.matchScore;
                            let displayScore = "N/A";

                            if (rawScore !== undefined && rawScore !== null) {
                                const num = parseFloat(rawScore);
                                if (!isNaN(num)) {
                                    displayScore = num <= 1 ? `${Math.round(num * 100)}%` : `${Math.round(num)}%`;
                                } else {
                                    displayScore = rawScore;
                                }
                            }

                            const scoreLabel = `Match Accuracy - ${displayScore}`;

                            // --- NEW: Restore Locked Card Rendering ---
                            if (locked) {
                                return (
                                    <LockedMatchCard
                                        key={i}
                                        cardVariants={cardVariants}
                                        onUnlockClick={() => {
                                            setPendingUnlockIndex(i);
                                            setShowUnlockModal(true);
                                        }}
                                    />
                                );
                            }

                            return (
                                <motion.div
                                    key={i}
                                    className="card-wrapper"
                                    variants={cardVariants}
                                    initial="visible" // FORCE VISIBLE TO DEBUG ANIMATION ISSUE
                                    animate="visible"
                                >
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

                                        {/* Platform Profile Button */}
                                        {(match.platformUrl || match.website) && (
                                            <a
                                                href={match.platformUrl || match.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="platform-profile-btn"
                                                onClick={(e) => e.stopPropagation()} // Prevent card click if any
                                            >
                                                Platform Profile ↗
                                            </a>
                                        )}

                                        <div className="card-meta">
                                            {/* INFLUENCER DETAILS (If User is Brand looking for Influencers) */}
                                            {role === 'brand' && (
                                                <>
                                                    <MetaRow label="Niche" value={match.niche} />
                                                    <MetaRow label="Followers" value={match.followers} />
                                                    <MetaRow label="Engagement Rate" value={match.engagementRate ? `${match.engagementRate}%` : null} />
                                                    <MetaRow label="Budget" value={processBudget(match.budget)} />
                                                </>
                                            )}

                                            {/* BRAND DETAILS (If User is Influencer looking for Brands) */}
                                            {role === 'influencer' && (
                                                <>
                                                    <MetaRow label="Niche" value={match.industry || match.niche} />
                                                    {/* Handle Array or String for Content */}
                                                    <MetaRow label="Preferred Content" value={match.contentType || (match.contentTypes?.join(", "))} />
                                                    <MetaRow label="Req. Engagement" value={match.minEngagement} />
                                                    <MetaRow label="Budget" value={processBudget(match.budget)} />
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
                        })
                    )}
                </motion.div>
            </main>

            {/* Unlock Match Modal */}
            <UnlockMatchModal
                isOpen={showUnlockModal}
                onClose={() => {
                    setShowUnlockModal(false);
                    setPendingUnlockIndex(null);
                }}
                onUnlock={handleUnlock}
            />
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
