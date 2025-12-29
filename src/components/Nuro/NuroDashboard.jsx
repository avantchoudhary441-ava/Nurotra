import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNuro } from '../../context/NuroContext';

export default function NuroDashboard({ onClose }) {
    const { mode } = useNuro();

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
                        <span className={`nuro-mode ${mode === 'active' ? 'active' : ''}`}>Active</span>
                        <span className="separator">|</span>
                        <span className={`nuro-mode ${mode === 'learning' ? 'active' : ''}`}>Learning</span>
                        <span className="separator">|</span>
                        <span className={`nuro-mode ${mode === 'advising' ? 'active' : ''}`}>Advising</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                {/* 2. MAIN CONTENT */}
                <div className="nuro-content">
                    {/* LEFT: SCORES */}
                    <div className="nuro-left-col">
                        <div className="nuro-score-panel">
                            <h4>Performance Summary</h4>
                            <div className="score-ring" style={{ '--score': `${data.score}%` }}>
                                <div className="score-inner">
                                    <span className="score-val">{data.score}</span>
                                    <span className="score-delta">▲ +{data.delta}%</span>
                                </div>
                            </div>

                            <hr style={{ borderColor: 'rgba(255,255,255,0.05)', margin: '2rem 0' }} />

                            <h4>Predicted Next Outcome</h4>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                                {data.prediction}% <span style={{ fontSize: '0.8rem', color: '#34d399' }}>Probability</span>
                            </div>
                        </div>

                        {/* COMPARISON UI */}
                        <div className="nuro-card" style={{ marginTop: '2rem' }}>
                            <h4>Comparison (Past vs Present)</h4>

                            <ComparisonBar label="Communication Clarity" past={data.comparison.clarity.past} current={data.comparison.clarity.current} />
                            <ComparisonBar label="Reliability Score" past={data.comparison.reliability.past} current={data.comparison.reliability.current} />
                            <ComparisonBar label="Trust Index" past={data.comparison.trust.past} current={data.comparison.trust.current} />
                        </div>
                    </div>

                    {/* RIGHT: DEEP DIVE */}
                    <div className="nuro-analysis-panel">
                        <div className="nuro-card">
                            <h4>What Went Right</h4>
                            <ul className="analysis-list">
                                {data.positives.map((item, i) => (
                                    <li key={i}><span className="pos-icon">✓</span> {item}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="nuro-card">
                            <h4>What Went Wrong</h4>
                            <ul className="analysis-list">
                                {data.negatives.map((item, i) => (
                                    <li key={i}><span className="neg-icon">⚠</span> {item}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="nuro-card">
                            <h4>Root Cause Analysis</h4>
                            <div className="root-cause-box">
                                "{data.rootCause}"
                            </div>
                        </div>

                        <div className="nuro-card">
                            <h4>Actionable Fixes (Next Time)</h4>
                            {data.fixes.map((fix, i) => (
                                <div key={i} className="action-checkbox">
                                    <input type="checkbox" />
                                    <span>{fix}</span>
                                </div>
                            ))}
                        </div>
                    </div>
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
