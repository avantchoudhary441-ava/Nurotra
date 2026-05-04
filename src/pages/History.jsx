import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    History as HistoryIcon,
    TrendingUp,
    Clock,
    Zap,
    Target,
    BrainCircuit,
    Award,
    ChevronDown,
    Activity,
    Users,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    MessageSquare,
    DollarSign
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    ReferenceArea,
    ReferenceLine
} from "recharts";
import Sidebar from "../components/Sidebar";
import BackgroundEffects from "../components/BackgroundEffects";
import { nuroService } from "../services/apiService";
import { useCurrency } from "../context/CurrencyContext";
import "../styles/history.css";

export default function History({ role = "influencer" }) {
    const { currency, selectedCountry, formatCurrency } = useCurrency();
    const [memory, setMemory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedCollab, setExpandedCollab] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await nuroService.getMemory();
                setMemory(data);
            } catch (err) {
                console.error("Failed to fetch history data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Retrieving your historical footprint...</p>
            </div>
        );
    }

    // Dynamic Patterns Helper - Swap "$" for current symbol or format correctly
    const processPattern = (pattern) => {
        if (!pattern) return "";
        // If pattern contains hardcoded "$", swap it with the current currency symbol
        // and if it's not INR, maybe apply currency conversion logic if we have raw numbers
        // But for strings, we simply swap the sign to match the toggle
        return pattern.replace(/\$/g, currency);
    };

    // Fallback Mock Data for empty states (Serious user demo mode)
    const collabHistory = (memory?.collabHistory?.length > 0) ? memory.collabHistory : [
        {
            collabId: "COL-001",
            timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            overallScore: 88,
            collabType: "Paid",
            outcome: "Success",
            duration: "2 weeks",
            satisfactionScore: { brand: 95, influencer: 90 },
            aiTag: "Smooth",
            positives: ["Exceptional response speed", "High quality brief adherence"],
            negatives: ["None significant"],
            rootCause: "High compatibility with brand vision."
        },
        {
            collabId: "COL-002",
            timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            overallScore: 72,
            collabType: "Short-term",
            outcome: "Partial",
            duration: "3 days",
            satisfactionScore: { brand: 75, influencer: 85 },
            aiTag: "Delayed",
            positives: ["Strong creative output"],
            negatives: ["Negotiated past deadline", "Delayed confirmation"],
            rootCause: "External logistics friction during negotiation."
        }
    ];

    const timelineData = [
        { date: "Jan", score: 65, phase: "Early stage" },
        { date: "Feb", score: 68, phase: "Early stage" },
        { date: "Mar", score: 75, phase: "Stable phase" },
        { date: "Apr", score: 72, phase: "Stable phase" },
        { date: "May", score: 85, phase: "High-performance" },
        { date: "Jun", score: 88, phase: "High-performance" },
    ];

    const replyTimeData = [
        { date: "Mon", minutes: 45 },
        { date: "Tue", minutes: 38 },
        { date: "Wed", minutes: 32 },
        { date: "Thu", minutes: 28 },
        { date: "Fri", minutes: 25 },
        { date: "Sat", minutes: 22 },
        { date: "Sun", minutes: 20 },
    ];

    const metrics = memory?.behavioralMetrics || {
        negotiationTime: 42,
        executionDelay: 18,
        aiInsightNote: "Response speed improved by 42% after June — correlates with higher success rate."
    };

    const alignment = memory?.audienceAlignment || {
        primaryFit: "Tech Lifestyle",
        secondaryFit: "Productivity Tools",
        avoidZone: ["Fast Fashion"],
        nicheStats: []
    };

    const patterns = (memory?.historicalPatterns?.length > 0 ? memory.historicalPatterns : [
        "You perform best in Tech niche with $1k - $3k budget range.",
        "Delays usually occur during negotiation stage; automation recommended.",
        "High alignment when content freedom is given by brand."
    ]).map(p => processPattern(p));

    const milestones = memory?.milestones?.length > 0 ? memory.milestones : [
        { label: "First successful collab", date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
        { label: "First repeat brand", date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
        { label: "Longest collaboration", date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }
    ];

    const aiLearnings = memory?.aiLearnings?.length > 0 ? memory.aiLearnings : [
        "Prefers highly detailed briefs over open-ended creative freedom.",
        "Reliability peaks during mid-week interactions.",
        "Sensitivity to feedback is constructive, leading to 1.5x repeat rate."
    ];

    return (
        <div className="influencer-dashboard">
            <BackgroundEffects />
            <Sidebar role={role} />

            <div className="influencer-main">
                <main className="history-container">

                    {/* 1. Header & Pattern Summary */}
                    <header className="history-header">
                        <div>
                            <h1>History</h1>
                            <p>Pure facts. Scalable intelligence.</p>
                        </div>
                        <div className="text-xs text-slate-500 italic">
                            Updated: {new Date().toLocaleDateString()}
                        </div>
                    </header>

                    {/* 4. Smart Past Collab Log (Moved to Top) */}
                    <section className="history-card">
                        <h3 className="card-title"><MessageSquare size={14} /> Past Collab Log</h3>
                        <div className="collab-log-list">
                            {collabHistory.slice().reverse().map((collab, idx) => (
                                <div key={idx} className="collab-row" onClick={() => setExpandedCollab(expandedCollab === idx ? null : idx)}>
                                    <div className="collab-row-header">
                                        <div className="collab-info">
                                            <span className="collab-type">{collab.collabType}</span>
                                            <span className={`collab-outcome outcome-${collab.outcome}`}>
                                                {collab.outcome === 'Success' ? <CheckCircle2 size={12} /> :
                                                    collab.outcome === 'Partial' ? <AlertTriangle size={12} /> : <AlertTriangle size={12} />}
                                                {collab.outcome}
                                            </span>
                                            <span className="text-sm font-medium text-slate-300">{collab.partnerName || collab.collabId}</span>
                                        </div>
                                        <div className="collab-meta">
                                            <span>{collab.duration}</span>
                                            <span className="collab-tag">{collab.aiTag}</span>
                                            <ChevronDown size={14} className={`transition-transform ${expandedCollab === idx ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {expandedCollab === idx && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="collab-details-expanded">
                                                    <div className="detail-block">
                                                        <h5>Satisfaction</h5>
                                                        <div className="flex gap-4 mt-2">
                                                            <div className="text-center">
                                                                <div className="text-xs text-slate-500 font-bold uppercase">Brand</div>
                                                                <div className="text-emerald-500 font-bold">{collab.satisfactionScore?.brand}%</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-xs text-slate-500 font-bold uppercase">You</div>
                                                                <div className="text-blue-500 font-bold">{collab.satisfactionScore?.influencer}%</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="detail-block">
                                                        <h5>Nuro Post-Mortem</h5>
                                                        <p className="detail-content">{collab.rootCause}</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="pattern-summary">
                        <h3><Target size={14} /> Your Historical Pattern</h3>
                        <div className="pattern-list">
                            {patterns.map((p, i) => (
                                <div key={i} className="pattern-item">
                                    <div className="pattern-dot" />
                                    <span>{p}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="history-grid">
                        <div className="history-main-col">

                            {/* 2. Evolution Timeline */}
                            <section className="history-card">
                                <h3 className="card-title"><Activity size={18} /> Evolution Timeline</h3>
                                <div style={{ width: '100%', height: 260 }}>
                                    <ResponsiveContainer>
                                        <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                                            <Tooltip />
                                            <Area
                                                type="monotone"
                                                dataKey="score"
                                                stroke="#6366f1"
                                                fillOpacity={1}
                                                fill="url(#colorScore)"
                                                strokeWidth={2}
                                            />
                                            <ReferenceLine x="Mar" stroke="#475569" strokeDasharray="3 3" label={{ position: 'top', value: 'Stable', fill: '#475569', fontSize: 10 }} />
                                            <ReferenceLine x="May" stroke="#475569" strokeDasharray="3 3" label={{ position: 'top', value: 'High Performance', fill: '#475569', fontSize: 10 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between mt-4 px-2">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Early (Learning)</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Growth Phase</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Performance Peak</span>
                                </div>
                            </section>

                            {/* 3. Behaviour Timeline */}
                            <section className="history-card">
                                <h3 className="card-title"><Clock size={14} /> Behaviour Timeline</h3>
                                <div className="behaviour-grid">
                                    <div className="behaviour-metric">
                                        <div className="metric-value">24m</div>
                                        <div className="metric-label">Avg Reply Time</div>
                                    </div>
                                    <div className="behaviour-metric">
                                        <div className="metric-value">{metrics.negotiationTime}h</div>
                                        <div className="metric-label">Negotiation</div>
                                    </div>
                                    <div className="behaviour-metric">
                                        <div className="metric-value">{metrics.executionDelay}h</div>
                                        <div className="metric-label">Execution Delay</div>
                                    </div>
                                </div>
                                <div className="mb-6 h-[100px]">
                                    <ResponsiveContainer>
                                        <LineChart data={replyTimeData}>
                                            <Line type="monotone" dataKey="minutes" stroke="#6366f1" strokeWidth={2} dot={false} />
                                            <Tooltip />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="ai-insight-note">
                                    <p>🧠 AI Insight: {metrics.aiInsightNote}</p>
                                </div>
                            </section>

                        </div>

                        <div className="history-side-col">

                            {/* 5. Audience Alignment Log */}
                            <section className="history-card">
                                <h3 className="card-title"><Users size={14} /> Audience Alignment</h3>
                                <div className="alignment-list">
                                    <div className="alignment-item">
                                        <span className="alignment-label">Primary Fit</span>
                                        <span className="alignment-value fit-primary">{alignment.primaryFit}</span>
                                    </div>
                                    <div className="alignment-item">
                                        <span className="alignment-label">Secondary Fit</span>
                                        <span className="alignment-value fit-secondary">{alignment.secondaryFit}</span>
                                    </div>
                                    <div className="alignment-item">
                                        <span className="alignment-label">Avoid Zone</span>
                                        <span className="alignment-value fit-avoid">{alignment.avoidZone[0]}</span>
                                    </div>
                                </div>
                                <div className="mt-4 p-3 bg-white/5 rounded-lg">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Stability Insight</p>
                                    <p className="text-xs text-slate-400">92% repeat success frequency in {alignment.primaryFit} projects.</p>
                                </div>
                            </section>

                            {/* 6. AI Memory Layer */}
                            <section className="history-card bg-indigo-500/5">
                                <h3 className="card-title"><BrainCircuit size={14} className="text-indigo-400" /> AI Memory Layer</h3>
                                <div className="memory-list">
                                    {aiLearnings.map((l, i) => (
                                        <div key={i} className="memory-learning">
                                            <div className="w-1 h-1 rounded-full bg-indigo-500 mt-2 shrink-0" />
                                            <p>{l}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[10px] text-slate-600 mt-2 border-t border-white/5 pt-2 italic">
                                    Nurotra memory is read-only and evolves through interaction.
                                </div>
                            </section>

                            {/* 7. Milestones & Flags */}
                            <section className="history-card">
                                <h3 className="card-title"><Award size={14} /> Milestones & Flags</h3>
                                <div className="milestones-list">
                                    {milestones.map((m, i) => (
                                        <div key={i} className="milestone-item">
                                            <span className="milestone-date">
                                                {new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </span>
                                            <span className="milestone-text">{m.label}</span>
                                            <CheckCircle2 size={12} className="text-emerald-500" />
                                        </div>
                                    ))}
                                </div>
                            </section>

                        </div>
                    </div>

                </main>
            </div>
        </div>
    );
}
