import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    TrendingUp,
    AlertCircle,
    BrainCircuit,
    Target,
    ChevronDown,
    ShieldCheck,
    Clock,
    Zap,
    CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BackgroundEffects from "../components/BackgroundEffects";
import { nuroService } from "../services/apiService";
import "../styles/collabInsights.css";

export default function CollabInsights({ role = "influencer" }) {
    const navigate = useNavigate();
    const [memory, setMemory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({
        success: true,
        failure: false,
        improvements: true,
        patterns: false
    });

    useEffect(() => {
        const fetchMemory = async () => {
            try {
                const data = await nuroService.getMemory();
                setMemory(data);
            } catch (err) {
                console.error("Failed to fetch Nuro insights", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMemory();
    }, []);

    const toggleSection = (section) => {
        setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Mock data if memory is empty for demo/new users
    const metrics = memory?.metrics || { compatibilityScore: 72, reliabilityScore: 65, trustIndex: 80 };
    const history = memory?.collabHistory || [];

    const getReadiness = () => {
        const score = (metrics.compatibilityScore + metrics.reliabilityScore + metrics.trustIndex) / 3;
        if (score > 75) return { label: "Ready", class: "readiness-ready" };
        if (score > 50) return { label: "Needs Optimization", class: "readiness-warning" };
        return { label: "High Risk", class: "readiness-risk" };
    };

    const readiness = getReadiness();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Analyzing your collab DNA...</p>
            </div>
        );
    }

    return (
        <div className="influencer-dashboard">
            <BackgroundEffects />
            <Sidebar role={role} />

            <div className="influencer-main">
                <div className="collab-insights-container">

                    {/* Header & Readiness Section */}
                    <header className="insights-header">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                Collab Insights
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Strategic analysis by Nuro AI</p>
                        </div>
                        <div className={`readiness-badge ${readiness.class}`}>
                            <div className="status-dot"></div>
                            {readiness.label}
                        </div>
                    </header>

                    <div className="insights-grid">

                        {/* 1. Successful Collabs Breakdown */}
                        <section className="insight-card">
                            <div className="card-header" onClick={() => toggleSection('success')}>
                                <h3><TrendingUp className="text-emerald-500" /> Successful Patterns</h3>
                                <div className="flex items-center gap-2">
                                    <span className="card-tag">Strength Signals</span>
                                    <ChevronDown className={`transition-transform ${expanded.success ? 'rotate-180' : ''}`} size={18} />
                                </div>
                            </div>
                            <AnimatePresence>
                                {expanded.success && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pattern-item">
                                            <div className="pattern-icon">✅</div>
                                            <div className="pattern-text">
                                                <strong>Brief Alignment:</strong> Your highest success comes from brands with highly technical, 2-page briefs.
                                            </div>
                                        </div>
                                        <div className="pattern-item">
                                            <div className="pattern-icon">⚡</div>
                                            <div className="pattern-text">
                                                <strong>Response Velocity:</strong> 100% success rate when initial response is under 40 minutes.
                                            </div>
                                        </div>
                                        <div className="pattern-item">
                                            <div className="pattern-icon">🎯</div>
                                            <div className="pattern-text">
                                                <strong>Audience Fit:</strong> Tech-lifestyle crossovers show 2x engagement compared to generic lifestyle.
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>

                        {/* 2. Failed Collabs Breakdown */}
                        <section className="insight-card border-red-500/10">
                            <div className="card-header" onClick={() => toggleSection('failure')}>
                                <h3><AlertCircle className="text-amber-500" /> Mismatch Analysis</h3>
                                <div className="flex items-center gap-2">
                                    <span className="card-tag">Preventable vs Sys</span>
                                    <ChevronDown className={`transition-transform ${expanded.failure ? 'rotate-180' : ''}`} size={18} />
                                </div>
                            </div>
                            <AnimatePresence>
                                {expanded.failure && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pattern-item border-l-2 border-amber-500/30">
                                            <div className="pattern-text text-gray-400">
                                                <span className="text-amber-500 font-semibold text-xs block mb-1">AUDIENCE OVERLAP GAP</span>
                                                Previous mismatch was due to lower than optimal audience overlap (22%).
                                            </div>
                                        </div>
                                        <div className="pattern-item border-l-2 border-red-500/30">
                                            <div className="pattern-text text-gray-400">
                                                <span className="text-red-500 font-semibold text-xs block mb-1">EXPECTATION GAP</span>
                                                Timeline pressure exceeded capacity during peak periods.
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>

                        {/* 3. AI Suggested Improvements */}
                        <section className="insight-card col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                            <div className="card-header" onClick={() => toggleSection('improvements')}>
                                <h3><BrainCircuit className="text-purple-400" /> Nuro's Optimization Map</h3>
                                <ChevronDown className={`transition-transform ${expanded.improvements ? 'rotate-180' : ''}`} size={18} />
                            </div>
                            <AnimatePresence>
                                {expanded.improvements && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <CheckCircle2 size={16} className="text-purple-400" />
                                                    <span className="text-[10px] font-bold text-purple-400 uppercase">Impact: High</span>
                                                </div>
                                                <h4 className="text-sm font-semibold mb-1">Tone Adjustment</h4>
                                                <p className="text-xs text-gray-500">More data-driven outreach would increase brand satisfaction by <span className="impact-badge">18%</span>.</p>
                                            </div>
                                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <CheckCircle2 size={16} className="text-purple-400" />
                                                    <span className="text-[10px] font-bold text-blue-400 uppercase">Impact: Med</span>
                                                </div>
                                                <h4 className="text-sm font-semibold mb-1">Deliverables Link</h4>
                                                <p className="text-xs text-gray-500">Adding 2 more verification proofs for engagement will boost your Trust Index.</p>
                                            </div>
                                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <CheckCircle2 size={16} className="text-purple-400" />
                                                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Impact: Low</span>
                                                </div>
                                                <h4 className="text-sm font-semibold mb-1">Budget Alignment</h4>
                                                <p className="text-xs text-gray-500">Small adjustment in base rate for tech niches improves match probability.</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>

                        {/* 4. Collab Predictive Score */}
                        <section className="insight-card">
                            <div className="card-header">
                                <h3><Target className="text-blue-400" /> Predictive Probability</h3>
                                <span className="card-tag">Next 30 Days</span>
                            </div>
                            <div className="predictive-wrap">
                                <div className="score-main">84%</div>
                                <p className="score-label">AI-estimated probability of successful match</p>
                                <div className="mt-4 h-2 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '84%' }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-600 mt-2 italic">Not a guarantee; based on current profile metrics.</p>
                            </div>
                        </section>

                        {/* 5. Pattern Insights (Knowledge Layer) */}
                        <section className="insight-card">
                            <div className="card-header" onClick={() => toggleSection('patterns')}>
                                <h3><Zap className="text-yellow-400" /> Nuro Knowledge</h3>
                                <ChevronDown className={`transition-transform ${expanded.patterns ? 'rotate-180' : ''}`} size={18} />
                            </div>
                            <AnimatePresence>
                                {expanded.patterns && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden space-y-3"
                                    >
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                            <span className="text-gray-400">You perform best in short-term campaigns.</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                            <span className="text-gray-400">High success when brand response is fast.</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                            <span className="text-gray-400">Audience mismatch is your primary friction point.</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>

                    </div>

                    {/* Positive Reinforcement & Connection */}
                    <footer className="mt-8 p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-emerald-500" />
                            <p className="text-sm text-gray-400">
                                <strong className="text-emerald-500">Current Strength:</strong> Your reliability score improved by 12% this month.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate(`/${role}/deliverables`)}
                            className="text-xs font-bold text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 transition-colors"
                        >
                            Review Deliverables 🔗
                        </button>
                    </footer>

                </div>
            </div>
        </div>
    );
}
