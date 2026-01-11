import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import "../styles/enhancer.css";
import { aiService } from "../services/apiService";

export default function ProfileEnhancer({ profileData, onClose, onApplyChanges }) {
    const [activeTab, setActiveTab] = useState("overview");
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch Analysis on Mount
    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                // Use the centralized aiService (which handles auth headers automatically)
                const data = await aiService.analyzeProfile(profileData);
                setAnalysis(data);
            } catch (error) {
                console.error("Analysis Failed", error);
                // Robust Fallback Data
                setAnalysis({
                    strengthAnalysis: { score: 65, strengths: ["Profile Exists", "Platform Connected", "Ready to Optimize"] },
                    gapAnalysis: { gaps: [{ title: "Connection Error", severity: "Low", reason: "Could not fetch AI insights. Check internet." }] },
                    marketComparison: {
                        you: { clarity: 50, engagement: 50, professionalism: 50 },
                        top10: { clarity: 90, engagement: 90, professionalism: 90 },
                        average: { clarity: 60, engagement: 60, professionalism: 60 }
                    },
                    optimizationSuggestions: [],
                    projectedImpact: { matchQualityUplift: 10, replyRateUplift: 5 },
                    enhancedBios: [
                        { style: "Fallback", content: "AI Connection Issue. Please retry.", reasoning: "System error." }
                    ],
                    contentStrategy: [],
                    compatibility: {
                        budgetFit: { score: 50, label: "Unknown", insight: "No data" },
                        nicheDemand: { score: 50, label: "Unknown", insight: "No data" },
                        contentViability: { score: 50, label: "Unknown", insight: "No data" }
                    }
                });
            } finally {
                setLoading(false);
            }
        };

        if (profileData) fetchAnalysis();
    }, [profileData]);

    const tabs = [
        { id: "overview", label: "Overview", icon: "📊" },
        { id: "enhanced", label: "Enhanced Profile", icon: "✨" },
        { id: "compatibility", label: "Compatibility", icon: "🤝" },
        { id: "optimize", label: "Action Plan", icon: "🚀" },
    ];

    if (!profileData) return null;

    return ReactDOM.createPortal(
        <div className="enhancer-overlay">
            <motion.div
                className="enhancer-window"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
            >
                {/* Header */}
                <div className="enhancer-header">
                    <div className="eh-title">
                        <h2>✨ Nurotra AI Studio <span className="beta-tag">2.0</span></h2>
                        <span>Profile Enhancement Engine</span>
                    </div>
                    <button className="eh-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="enhancer-body">
                    {/* LEFT PANEL */}
                    <div className="enhancer-sidebar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`eh-nav-item ${activeTab === tab.id ? "active" : ""}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <span className="eh-nav-icon">{tab.icon}</span>
                                <span className="eh-nav-label">{tab.label}</span>
                                <span className={`eh-dot ${loading ? "loading" : "ready"}`}>●</span>
                            </button>
                        ))}
                    </div>

                    {/* RIGHT PANEL - DYNAMIC CONTENT */}
                    <div className="enhancer-content">
                        {loading ? (
                            <div className="eh-loading">
                                <div className="spinner"></div>
                                <p>Generating AI Strategy...</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="eh-tab-content"
                                >
                                    {renderTabContent(activeTab, analysis)}
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}

// ------------------------------------
// TAB RENDERERS (UPDATED)
// ------------------------------------
function renderTabContent(tab, data) {
    if (!data) return <div className="eh-error">No data available</div>;

    switch (tab) {
        case "overview":
            return (
                <div className="eh-dashboard-grid">
                    <div className="eh-section-half">
                        <h3>Profile Strength</h3>
                        <div className="eh-score-large">
                            {/* ANIMATED COUNT UP */}
                            <CountUp value={data?.strengthAnalysis?.score || 0} suffix="%" />
                            <div className="score-detail">
                                {data?.strengthAnalysis?.strengths?.slice(0, 2).map((s, i) => (
                                    <span key={i} className="mini-tag">✅ {s}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="eh-section-half">
                        <h3>Projected Impact</h3>
                        <div className="eh-impact-row">
                            <div className="impact-box">
                                {/* ANIMATED COUNT UP */}
                                <CountUp value={data?.projectedImpact?.matchQualityUplift || 0} prefix="+" suffix="%" />
                                <label>Matches</label>
                            </div>
                            <div className="impact-box">
                                <CountUp value={data?.projectedImpact?.replyRateUplift || 0} prefix="+" suffix="%" />
                                <label>Replies</label>
                            </div>
                        </div>
                    </div>

                    <div className="eh-section-full">
                        <h3>Market Comparison</h3>
                        <p className="eh-subtext">See how you measure up against the Top 10% in your niche.</p>
                        <div className="eh-chart-container small-chart">
                            <AnimatedChartRow index={0} label="Clarity" you={data?.marketComparison?.you?.clarity} top={90} />
                            <AnimatedChartRow index={1} label="Engagement" you={data?.marketComparison?.you?.engagement} top={90} />
                            <AnimatedChartRow index={2} label="Professionalism" you={data?.marketComparison?.you?.professionalism} top={95} />
                        </div>
                    </div>
                </div>
            );

        case "enhanced":
            return (
                <div className="eh-section-scroll">
                    <div className="eh-block">
                        <h3>✨ AI Enhanced Bios</h3>
                        <p className="eh-subtext">Optimized options to convert visitors into partners.</p>
                        <div className="eh-bios-grid">
                            {data?.enhancedBios?.map((bio, i) => (
                                <div key={i} className="bio-card">
                                    <div className="bio-header">
                                        <span className="bio-style-badge">{bio.style}</span>
                                        <button className="copy-btn" onClick={() => navigator.clipboard.writeText(bio.content)}>Copy</button>
                                    </div>
                                    <p className="bio-content">{bio.content}</p>
                                    <p className="bio-reason">💡 {bio.reasoning}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="eh-block">
                        <h3>📅 Smart Content Strategy</h3>
                        <div className="eh-content-list">
                            {data?.contentStrategy?.map((idea, i) => (
                                <div key={i} className="content-idea-card">
                                    <div className="idea-head">
                                        <h4>{idea.title}</h4>
                                        <span className="idea-tag">{idea.idea}</span>
                                    </div>
                                    <div className="idea-body">
                                        <p><strong>Caption:</strong> {idea.caption}</p>
                                        <p className="hashtags">{idea.hashtags}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );

        case "compatibility":
            return (
                <div className="eh-section">
                    <h3>Compatibility Analysis</h3>
                    <p className="eh-subtext">How your profile stacks up against active Brand requirements.</p>

                    <div className="compatibility-grid">
                        <CompatibilityCard
                            title="Budget Fit"
                            data={data?.compatibility?.budgetFit}
                            icon="💰"
                        />
                        <CompatibilityCard
                            title="Niche Demand"
                            data={data?.compatibility?.nicheDemand}
                            icon="🔥"
                        />
                        <CompatibilityCard
                            title="Content Viability"
                            data={data?.compatibility?.contentViability}
                            icon="📹"
                        />
                    </div>
                </div>
            );

        case "optimize":
            // Fallback if data structure is old
            const platformSuggestions = data?.optimizationSuggestions?.platform || data?.optimizationSuggestions || [];
            const nurotraSuggestions = data?.optimizationSuggestions?.nurotra || [];

            return (
                <div className="eh-section-scroll">
                    <div className="eh-split-cols">
                        {/* LEFT: EXTERNAL PLATFORM */}
                        <div className="eh-col">
                            <h3>🌐 Platform Suggestions</h3>
                            <p className="eh-subtext">Optimize your Instagram/LinkedIn presence.</p>
                            <div className="eh-cards-grid-col">
                                {Array.isArray(platformSuggestions) && platformSuggestions.map((s, i) => (
                                    <div key={i} className="eh-card action-card">
                                        <h4>🛠 {s.title}</h4>
                                        <span className={`impact-badge`}>High Impact</span>
                                        <p>{s.instruction}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: NUROTRA INTERNAL */}
                        <div className="eh-col">
                            <h3>⚡ Nurotra Profile</h3>
                            <p className="eh-subtext">Improve your internal matching score.</p>
                            <div className="eh-cards-grid-col">
                                {Array.isArray(nurotraSuggestions) && nurotraSuggestions.length > 0 ? (
                                    nurotraSuggestions.map((s, i) => (
                                        <div key={i} className="eh-card action-card nurotra-card">
                                            <h4>🚀 {s.title}</h4>
                                            <span className={`impact-badge`}>System Boost</span>
                                            <p>{s.instruction}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="eh-empty-state">
                                        <p>✅ Your Nurotra Profile is fully optimized!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );

        default: return null;
    }
}

// ------------------------------------
// SUB-COMPONENTS
// ------------------------------------

// ANIMATED COUNTER
function CountUp({ value, prefix = "", suffix = "" }) {
    const spring = useSpring(0, { stiffness: 50, damping: 15 });
    const display = useTransform(spring, (current) =>
        `${prefix}${Math.round(current)}${suffix}`
    );

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    return <motion.span className="score-val">{display}</motion.span>;
}

function CompatibilityCard({ title, data, icon }) {
    if (!data) return null;
    const colorClass = data.score > 70 ? "green" : data.score > 40 ? "yellow" : "red";

    return (
        <div className="comp-card">
            <div className="comp-icon">{icon}</div>
            <div className="comp-info">
                <h4>{title}</h4>
                <div className="comp-meter">
                    <motion.div
                        className={`comp-fill ${colorClass}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${data.score}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </div>
                <div className="comp-meta">
                    <span className="comp-label">{data.label}</span>
                    <span className="comp-insight">{data.insight}</span>
                </div>
            </div>
        </div>
    );
}

// ANIMATED STAGGERED BARS
function AnimatedChartRow({ index, label, you, top }) {
    const barVariants = {
        hidden: { width: 0 },
        visible: (custom) => ({
            width: `${custom}%`,
            transition: { duration: 1.2, ease: "easeOut", delay: index * 0.2 }
        })
    };

    // Determine color based on you vs top
    const isGood = (you || 0) >= (top || 90) * 0.8;
    const barColor = isGood ? "#a78bfa" : "#f472b6"; // Purple vs Pink/Alert

    return (
        <div className="chart-row">
            <span className="chart-label">{label}</span>
            <div className="chart-bars">
                <div className="bar-bg">
                    {/* TOP Benchmark Bar */}
                    <motion.div
                        className="bar-fill top-fill"
                        initial="hidden"
                        animate="visible"
                        custom={top}
                        loading="lazy"
                    />

                    {/* USER Bar */}
                    <motion.div
                        className="bar-fill you-fill"
                        initial="hidden"
                        animate="visible"
                        custom={you || 0}
                        style={{ background: barColor }} // Dynamic Color
                        variants={barVariants}
                    >
                        <span className="bar-text">You</span>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
