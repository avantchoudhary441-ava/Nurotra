import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldCheck,
    ShieldAlert,
    Fingerprint,
    Activity,
    CreditCard,
    Users,
    Zap,
    AlertCircle,
    CheckCircle2,
    Lock,
    Eye,
    Globe,
    ExternalLink,
    Clock
} from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell as ReCell
} from "recharts";
import Sidebar from "../components/Sidebar";
import BackgroundEffects from "../components/BackgroundEffects";
import { nuroService, profileService } from "../services/apiService";
import { localizeText } from "../utils/textUtils";
import "../styles/safetyTrust.css";

export default function SafetyTrust({ role = "influencer" }) {
    const { userId } = useParams();
    const [memory, setMemory] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (userId) {
                    const [memoryData, profileData] = await Promise.all([
                        nuroService.getPublicMemory(userId),
                        role === 'influencer'
                            ? profileService.getInfluencerById(userId)
                            : profileService.getBrandById(userId)
                    ]);
                    setMemory(memoryData);
                    setProfile(profileData);
                } else {
                    const data = await nuroService.getMemory();
                    setMemory(data);
                }
            } catch (err) {
                console.error("Failed to fetch safety data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId, role]);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Scanning risk factors & calibrating trust parameters...</p>
            </div>
        );
    }

    // Fallback Mock Data for demo
    const profileName = profile?.brandName || profile?.userId?.name || (userId ? "The user" : "You");

    const snapshot = memory?.trustSnapshot || {
        compositeScore: 84,
        status: 'Stable',
        statusMessage: localizeText("Your trust standing across identity, behaviour, and reliability.", profileName, !!userId)
    };

    const pillars = memory?.trustPillars || {
        identity: { emailVerified: true, socialVerified: true, authenticityRate: 92, identityScore: 95 },
        behavioralIntegrity: { spamSignal: 'Low', fakeFollowerEstimate: 4, interactionHealth: 98, integrityScore: 94 },
        transactionalTrust: { paymentSafetyScore: 100, agreementTransparency: 95, disputeRate: 0, transactionalScore: 98 },
        communitySignal: { reputationHeatmap: [], socialProofScore: 88 }
    };

    const scoreData = [
        { name: 'Score', value: snapshot.compositeScore },
        { name: 'Remaining', value: 100 - snapshot.compositeScore }
    ];

    const COLORS = ['#6366f1', 'rgba(255, 255, 255, 0.05)'];

    const heatmapData = [
        { day: 'Mon', value: 40 },
        { day: 'Tue', value: 70 },
        { day: 'Wed', value: 90 },
        { day: 'Thu', value: 65 },
        { day: 'Fri', value: 85 },
        { day: 'Sat', value: 95 },
        { day: 'Sun', value: 80 },
    ];

    return (
        <div className="influencer-dashboard">
            <BackgroundEffects />
            <Sidebar role={role} />

            <div className="influencer-main">
                <main className="safety-container">

                    {/* Header */}
                    <header className="safety-header">
                        <div>
                            <h1>Safety & Trust</h1>
                            <p>Guardian intelligence & Risk assessment layer.</p>
                        </div>
                        <div className="text-xs text-slate-500 italic">
                            Agentic Monitoring: Active
                        </div>
                    </header>

                    {/* Layer 1: Trust Snapshot */}
                    <section className="trust-snapshot">
                        <div className="snapshot-score-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                    <Pie
                                        data={scoreData}
                                        innerRadius="75%"
                                        outerRadius="95%"
                                        paddingAngle={0}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        strokeWidth={0}
                                        isAnimationActive={true}
                                    >
                                        <Cell fill={COLORS[0]} stroke={COLORS[0]} strokeWidth={1} />
                                        <Cell fill={COLORS[1]} stroke={COLORS[1]} strokeWidth={1} />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="snapshot-inner-text">
                                <motion.span
                                    className="trust-score-number"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.8, delay: 0.5 }}
                                >
                                    {snapshot.compositeScore}%
                                </motion.span>
                                <motion.span
                                    className="trust-index-label"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 1, delay: 1 }}
                                >
                                    Trust Index
                                </motion.span>
                            </div>
                        </div>

                        <div className="snapshot-info">
                            <div className={`status-badge status-${snapshot.status}`}>
                                <div className="status-dot-glowing" />
                                {snapshot.status}
                            </div>
                            <p className="snapshot-message">{snapshot.statusMessage}</p>
                            <div className="mt-4 flex gap-6">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Clock size={14} className="text-indigo-400" />
                                    <span>Monitoring for 124 days</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Eye size={14} className="text-emerald-400" />
                                    <span>Visible to premium brands</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Layer 2: Trust Pillars Grid */}
                    <div className="pillars-grid">

                        {/* Pillar A: Identity */}
                        <section className="pillar-card">
                            <div className="pillar-header">
                                <div className="pillar-title"><Fingerprint /> Identity & Authenticity</div>
                                <div className="pillar-score">{pillars.identity.identityScore}</div>
                            </div>
                            <div className="pillar-stats">
                                <div className="stat-row">
                                    <div className="stat-label-wrap">
                                        <span className="stat-label">Email Verification</span>
                                        <span className="stat-value text-emerald-400">Verified</span>
                                    </div>
                                    <div className="stat-bar-bg"><div className="stat-bar-fill" style={{ width: '100%' }} /></div>
                                </div>
                                <div className="stat-row">
                                    <div className="stat-label-wrap">
                                        <span className="stat-label">Social Authenticity</span>
                                        <span className="stat-value">{pillars.identity.authenticityRate}%</span>
                                    </div>
                                    <div className="stat-bar-bg"><div className="stat-bar-fill" style={{ width: `${pillars.identity.authenticityRate}%` }} /></div>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                    <Lock size={10} /> {localizeText("Data encrypted & anonymized per Nuro standards.", profileName, !!userId)}
                                </div>
                            </div>
                        </section>

                        {/* Pillar B: Behavioral Integrity */}
                        <section className="pillar-card">
                            <div className="pillar-header">
                                <div className="pillar-title"><Activity /> Behavioral Integrity</div>
                                <div className="pillar-score">{pillars.behavioralIntegrity.integrityScore}</div>
                            </div>
                            <div className="pillar-stats">
                                <div className="stat-row">
                                    <div className="stat-label-wrap">
                                        <span className="stat-label">Spam Risk Level</span>
                                        <span className="stat-value text-emerald-400">{pillars.behavioralIntegrity.spamSignal}</span>
                                    </div>
                                    <div className="stat-bar-bg"><div className="stat-bar-fill" style={{ width: '10%' }} /></div>
                                </div>
                                <div className="stat-row">
                                    <div className="stat-label-wrap">
                                        <span className="stat-label">Interaction Health</span>
                                        <span className="stat-value">{pillars.behavioralIntegrity.interactionHealth}%</span>
                                    </div>
                                    <div className="stat-bar-bg"><div className="stat-bar-fill" style={{ width: `${pillars.behavioralIntegrity.interactionHealth}%` }} /></div>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-500">
                                    {localizeText("AI is monitoring your tone consistency & response patterns.", profileName, !!userId)}
                                </div>
                            </div>
                        </section>

                        {/* Pillar C: Transactional Trust */}
                        <section className="pillar-card">
                            <div className="pillar-header">
                                <div className="pillar-title"><CreditCard /> Transactional Trust</div>
                                <div className="pillar-score">{pillars.transactionalTrust.transactionalScore}</div>
                            </div>
                            <div className="pillar-stats">
                                <div className="stat-row">
                                    <div className="stat-label-wrap">
                                        <span className="stat-label">Payment Safety</span>
                                        <span className="stat-value">{pillars.transactionalTrust.paymentSafetyScore}%</span>
                                    </div>
                                    <div className="stat-bar-bg"><div className="stat-bar-fill" style={{ width: `${pillars.transactionalTrust.paymentSafetyScore}%` }} /></div>
                                </div>
                                <div className="stat-row">
                                    <div className="stat-label-wrap">
                                        <span className="stat-label">Agreement Transparency</span>
                                        <span className="stat-value">{pillars.transactionalTrust.agreementTransparency}%</span>
                                    </div>
                                    <div className="stat-bar-bg"><div className="stat-bar-fill" style={{ width: `${pillars.transactionalTrust.agreementTransparency}%` }} /></div>
                                </div>
                                <div className="mt-2 flex justify-between items-center text-[10px] text-slate-500">
                                    <span>Dispute Rate: {pillars.transactionalTrust.disputeRate}%</span>
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                </div>
                            </div>
                        </section>

                        {/* Pillar D: Community Signal */}
                        <section className="pillar-card">
                            <div className="pillar-header">
                                <div className="pillar-title"><Users /> Reputation Signal</div>
                                <div className="pillar-score">{pillars.communitySignal.socialProofScore}</div>
                            </div>
                            <div className="pillar-stats">
                                <div className="heatmap-container">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={heatmapData}>
                                            <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
                                            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                                {heatmapData.map((entry, index) => (
                                                    <ReCell key={index} fill={entry.value > 80 ? '#6366f1' : 'rgba(99, 102, 241, 0.3)'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-[10px] text-slate-500 text-center mt-2">
                                    Social Proof Heatmap: Positive interactions over last 7 days.
                                </p>
                            </div>
                        </section>

                    </div>

                    {/* Layer 3: Guardian Intelligence - Hidden while inspecting */}
                    {!userId && (
                        <section className="guardian-intel">
                            <div className="guardian-header">
                                <Zap className="text-indigo-400" />
                                <h3>Guardian Intelligence (Nuro)</h3>
                            </div>
                            <div className="intel-grid">
                                <div className="intel-item">
                                    <ShieldCheck className="intel-icon" />
                                    <div className="intel-content">
                                        <h4>Consistency Stabilized</h4>
                                        <p>Your interaction health has remained at 100% since last week. This improves brand confidence by 12%.</p>
                                    </div>
                                </div>
                                <div className="intel-item">
                                    <AlertCircle className="intel-icon text-amber-400" />
                                    <div className="intel-content">
                                        <h4>Profile Gap Detected</h4>
                                        <p>Missing social handle verification is holding your identity score back from reaching 100%.</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
}
