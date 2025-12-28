import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "../styles/enhancer.css";
import { aiService } from "../services/apiService"; // Correct import

export default function ProfileEnhancer({ profileData, onClose, onApplyChanges }) {
    const [activeTab, setActiveTab] = useState("strength");
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
                    projectedImpact: { matchQualityUplift: 10, replyRateUplift: 5 }
                });
            } finally {
                setLoading(false);
            }
        };

        if (profileData) fetchAnalysis();
    }, [profileData]);

    const tabs = [
        { id: "strength", label: "Profile Strength", icon: "💪" },
        { id: "gaps", label: "Profile Gaps", icon: "⚠️" },
        { id: "market", label: "Market Comparison", icon: "📊" },
        { id: "optimize", label: "Optimization", icon: "🚀" },
        { id: "impact", label: "Projected Impact", icon: "📈" },
    ];

    if (!profileData) return null;

    return (
        <div className="enhancer-overlay">
            <motion.div
                className="enhancer-window"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
            >
                {/* Header */}
                <div className="enhancer-header">
                    <div className="eh-title">
                        <h2>✨ Nurotra AI Studio</h2>
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

                    {/* RIGHT PANEL */}
                    <div className="enhancer-content">
                        {loading ? (
                            <div className="eh-loading">
                                <div className="spinner"></div>
                                <p>AI is analyzing your profile...</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="eh-tab-content"
                                >
                                    {renderTabContent(activeTab, analysis)}
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ------------------------------------
// TAB RENDERERS
// ------------------------------------
function renderTabContent(tab, data) {
    if (!data) return <div className="eh-error">No data available</div>;

    switch (tab) {
        case "strength":
            const score = data?.strengthAnalysis?.score || 0;
            const strengths = data?.strengthAnalysis?.strengths || [];
            return (
                <div className="eh-section">
                    <h3>Your Profile Strengths</h3>
                    <div className="eh-score-circle">
                        <span className="score-val">{score}%</span>
                        <span className="score-label">Confidence Score</span>
                    </div>
                    <div className="eh-cards-grid">
                        {strengths.map((s, i) => (
                            <div key={i} className="eh-card strength-card">
                                <span className="check-icon">✅</span>
                                {s}
                            </div>
                        ))}
                        {strengths.length === 0 && <p className="text-muted-custom">No specific strengths detected yet.</p>}
                    </div>
                </div>
            );
        case "gaps":
            const gaps = data?.gapAnalysis?.gaps || [];
            return (
                <div className="eh-section">
                    <h3>Areas Limiting Your Matches</h3>
                    <div className="eh-list">
                        {gaps.map((gap, i) => (
                            <div key={i} className="eh-alert-card">
                                <div className="alert-header">
                                    <span className="alert-icon">⚠️</span>
                                    <h4>{gap.title}</h4>
                                    <span className={`severity-badge ${gap.severity ? gap.severity.toLowerCase() : 'low'}`}>
                                        {gap.severity || "Low"}
                                    </span>
                                </div>
                                <p>{gap.reason}</p>
                            </div>
                        ))}
                        {gaps.length === 0 && <p className="text-muted-custom">No critical gaps found!</p>}
                    </div>
                </div>
            );
        case "market":
            // Safe access using optional chaining
            const market = data?.marketComparison;
            // Provide defaults if null
            const you = market?.you || { clarity: 0, engagement: 0, professionalism: 0 };
            const top10 = market?.top10 || { clarity: 100, engagement: 100, professionalism: 100 };
            const average = market?.average || { clarity: 50, engagement: 50, professionalism: 50 };

            return (
                <div className="eh-section">
                    <h3>Compared to Top 10%</h3>
                    <div className="eh-chart-container">
                        <ChartRow label="Clarity" you={you.clarity} top={top10.clarity} avg={average.clarity} />
                        <ChartRow label="Engagement" you={you.engagement} top={top10.engagement} avg={average.engagement} />
                        <ChartRow label="Professionalism" you={you.professionalism} top={top10.professionalism} avg={average.professionalism} />
                    </div>
                    <p className="eh-chart-insight">Top profiles utilize clear CTAs and collaboration history.</p>
                </div>
            );
        case "optimize":
            const suggestions = data?.optimizationSuggestions || [];
            return (
                <div className="eh-section">
                    <h3>Suggested Improvements</h3>
                    <div className="eh-cards-grid">
                        {suggestions.map((s, i) => (
                            <div key={i} className="eh-card action-card">
                                <h4>🛠 {s.title}</h4>
                                <span className={`impact-badge`}>Impact: {s.impact}</span>
                                <p>{s.instruction}</p>
                            </div>
                        ))}
                        {suggestions.length === 0 && <p className="text-muted-custom">Profile looks great! No suggestions.</p>}
                    </div>
                </div>
            );
        case "impact":
            const impact = data?.projectedImpact || { matchQualityUplift: 0, replyRateUplift: 0 };
            return (
                <div className="eh-section">
                    <h3>Projected Impact</h3>
                    <div className="eh-impact-stats">
                        <div className="impact-stat">
                            <span className="impact-num">+{impact.matchQualityUplift}%</span>
                            <label>Match Quality</label>
                        </div>
                        <div className="impact-stat">
                            <span className="impact-num">+{impact.replyRateUplift}%</span>
                            <label>Reply Rate</label>
                        </div>
                    </div>
                    <p className="impact-sub">Based on Nurotra historical data.</p>
                </div>
            );
        default: return null;
    }
}

function ChartRow({ label, you, top, avg }) {
    return (
        <div className="chart-row">
            <span className="chart-label">{label}</span>
            <div className="chart-bars">
                {/* Top 10% Marker */}
                <div className="bar-bg">
                    <div className="bar-fill top-fill" style={{ width: `${top}%` }}></div>
                    <div className="bar-fill you-fill" style={{ width: `${you}%` }}>You</div>
                </div>
            </div>
        </div>
    );
}
