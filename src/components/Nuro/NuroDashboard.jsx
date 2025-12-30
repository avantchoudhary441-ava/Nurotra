import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNuro } from '../../context/NuroContext';

export default function NuroDashboard({ onClose }) {
    const { mode, setMode, triggerInterrupt } = useNuro();

    // Mock Data (In phases, this will come from api/nuro/memory)
    const data = {
        score: 82,
        delta: 14,
        positives: ["Fast response time", "Clear expectations"],
        negatives: ["Over-negotiation on pricing", "Late deliverable confirmation"],
        rootCause: "Tone shifted from confident to defensive after budget discussion.",
        fixes: ["Use suggested pricing script", "Respond within 6 hours"],
        prediction: 71,
        comparison: {
            clarity: { past: 50, current: 90 },
            reliability: { past: 30, current: 80 },
            trust: { past: 45, current: 85 }
        }
    };

    return (
        <div className="nuro-dashboard-overlay">
            <motion.div
                className="nuro-window"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
            >
                {/* 1. STATUS BAR */}
                <div className="nuro-status-bar">
                    <div className="nuro-logo">✨ NURO CORE</div>
                    <div className="nuro-mode-indicator">
                        <span
                            className={`nuro-mode ${mode === 'active' ? 'active' : ''}`}
                            onClick={() => setMode('active')}
                            style={{ cursor: 'pointer' }}
                        >
                            Active
                        </span>
                        <span className="separator">|</span>
                        <span
                            className={`nuro-mode ${mode === 'learning' ? 'active' : ''}`}
                            onClick={() => setMode('learning')}
                            style={{ cursor: 'pointer' }}
                        >
                            Learning
                        </span>
                        <span className="separator">|</span>
                        <span
                            className={`nuro-mode ${mode === 'advising' ? 'active' : ''}`}
                            onClick={() => setMode('advising')}
                            style={{ cursor: 'pointer' }}
                        >
                            Advising
                        </span>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                {/* 2. MAIN CONTENT */}
                <div className="nuro-content">
                    {/* ACTIVE MODE - LIVE MONITORING */}
                    {mode === 'active' && (
                        <div className="active-mode-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                            <div className="live-orb" style={{ fontSize: '4rem', marginBottom: '2rem', animation: 'pulse-think 3s infinite' }}>📡</div>
                            <h2 style={{ color: 'white', marginBottom: '0.5rem' }}>Current Observation</h2>
                            <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '400px', marginBottom: '3rem' }}>
                                "I’m watching. Everything is fine so far. Your tone is confident."
                            </p>

                            {/* Live Stream Simulation */}
                            <div className="live-stream-feed" style={{ width: '100%', maxWidth: '500px', textAlign: 'left' }}>
                                <div className="feed-item" style={{ padding: '10px', borderLeft: '3px solid #34d399', background: 'rgba(255,255,255,0.02)', marginBottom: '10px' }}>
                                    <small style={{ color: '#34d399', textTransform: 'uppercase' }}>Tone Shift</small>
                                    <div style={{ color: 'white' }}>Neutral ➞ Enthusiastic</div>
                                </div>
                                <div className="feed-item" style={{ padding: '10px', borderLeft: '3px solid #60a5fa', background: 'rgba(255,255,255,0.02)' }}>
                                    <small style={{ color: '#60a5fa', textTransform: 'uppercase' }}>Decision Timing</small>
                                    <div style={{ color: 'white' }}>Optimal response delay (2m)</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LEARNING MODE - ANALYTICS */}
                    {mode === 'learning' && (
                        <div className="nuro-learning-grid">
                            {/* LEFT: SCORES */}
                            <div className="nuro-left-col">
                                <div className="nuro-score-panel">
                                    <h4>Growth Analysis</h4>
                                    <div className="score-ring" style={{ '--score': `${data.score}%` }}>
                                        <div className="score-inner">
                                            <span className="score-val">{data.score}</span>
                                            <span className="score-delta">▲ +{data.delta}%</span>
                                        </div>
                                    </div>

                                    <div className="educational-note" style={{ marginTop: '2rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                                        "You negotiated better than last time, but listened less."
                                    </div>
                                </div>

                                {/* COMPARISON UI */}
                                <div className="nuro-card" style={{ marginTop: '2rem' }}>
                                    <h4>Improvement vs Regression</h4>
                                    <ComparisonBar label="Communication Clarity" past={data.comparison.clarity.past} current={data.comparison.clarity.current} />
                                    <ComparisonBar label="Reliability Score" past={data.comparison.reliability.past} current={data.comparison.reliability.current} />
                                    <ComparisonBar label="Trust Index" past={data.comparison.trust.past} current={data.comparison.trust.current} />
                                </div>
                            </div>

                            {/* RIGHT: DEEP DIVE */}
                            <div className="nuro-analysis-panel">
                                <div className="nuro-card">
                                    <h4>Why It Happened? (Root Cause)</h4>
                                    <p style={{ fontSize: '1.1rem', color: '#fbbf24', lineHeight: '1.6' }}>
                                        "{data.rootCause}"
                                    </p>
                                </div>

                                <div className="nuro-card">
                                    <h4>What Changed Since Last Time?</h4>
                                    <ul className="analysis-list">
                                        <li><span className="pos-icon">✓</span> Response time improved by 40%</li>
                                        <li><span className="neg-icon">⚠</span> Tone became defensive earlier in the chat</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ADVISING MODE - FIXES */}
                    {mode === 'advising' && (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '0 2rem' }}>
                            <div className="nuro-header-text" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                <h2>Advisory Board</h2>
                                <p style={{ color: 'rgba(255,255,255,0.5)' }}>Translating insight into action.</p>
                            </div>

                            <div className="nuro-advising-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', flex: 1, overflowY: 'auto' }}>

                                {/* LEFT: DIAGNOSIS CONTEXT */}
                                <div className="nuro-card" style={{ height: 'fit-content', borderLeft: '4px solid #f472b6', background: 'rgba(244, 114, 182, 0.05)' }}>
                                    <h4 style={{ color: '#f472b6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                        <span>🧠</span> Analysis Context
                                    </h4>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>Identified Root Cause</label>
                                        <p style={{ fontSize: '1.1rem', color: 'white', marginTop: '0.5rem', lineHeight: '1.6', fontStyle: 'italic' }}>
                                            "{data.rootCause}"
                                        </p>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>Impact</label>
                                        <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem' }}>
                                            This caused a friction point in the negotiation phase, lowering trust score by 15%.
                                        </p>
                                    </div>
                                </div>

                                {/* RIGHT: SOLUTION PROTOCOL */}
                                <div className="nuro-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ marginBottom: '1.5rem' }}>Recommended Solution Protocol</h4>

                                    <div style={{ display: 'grid', gap: '1rem', flex: 1 }}>
                                        {data.fixes.map((fix, i) => (
                                            <div key={i} className="action-checkbox" style={{ padding: '1.2rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <div style={{ width: '12px', height: '12px', background: '#34d399', borderRadius: '50%', opacity: 0 }}></div>
                                                </div>
                                                <span style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.9)' }}>{fix}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        className="nuro-cta-btn"
                                        style={{
                                            marginTop: '2rem',
                                            width: '100%',
                                            padding: '1.2rem',
                                            background: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
                                            border: 'none',
                                            borderRadius: '12px',
                                            color: '#fff',
                                            fontWeight: '800',
                                            fontSize: '1rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 20px rgba(219, 39, 119, 0.4)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px',
                                            transition: 'transform 0.2s'
                                        }}
                                        onClick={() => alert("Nuro is guiding you to the settings page to update your auto-reply scripts...")}
                                    >
                                        🚀 Execute Improvement Plan
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </motion.div>
        </div>
    );
}

function ComparisonBar({ label, past, current }) {
    return (
        <div className="comp-bar-row">
            <div className="comp-bar-label">
                <span>{label}</span>
                <span>{current}/100</span>
            </div>
            <div className="comp-track">
                {/* Past - Ghost Bar */}
                <div className="comp-fill past" style={{ width: `${past}%` }}></div>
                {/* Current - Solid Bar */}
                <div className="comp-fill" style={{ width: `${current}%` }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '0.7rem', opacity: 0.5 }}>
                <span>Last: {past}</span>
                <span>Now: {current}</span>
            </div>
        </div>
    );
}
