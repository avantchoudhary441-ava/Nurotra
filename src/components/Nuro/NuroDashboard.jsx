import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion';

import { useNuroCore } from '../../context/NuroCoreContext';

export default function NuroDashboard({ onClose }) {
    const { mode, switchMode } = useNuroCore();
    const navigate = useNavigate();

    // Mapping implicit modes to dashboard views
    const getActiveView = () => {
        if (mode === 'guiding') return 'active';
        if (mode === 'advising') return 'advising';
        return 'learning'; // Default for observing/learning
    };

    const activeMode = getActiveView();

    const handleModeClick = (view) => {
        if (view === 'active') switchMode('guiding');
        else if (view === 'advising') switchMode('advising');
        else switchMode('learning');
    };

    // Mock Data (In phases, this will come from api/nuro/memory)
    const data = {
        score: 82,
        delta: 14,
        positives: ["Fast response time", "Clear expectations"],
        negatives: ["Over-negotiation on pricing", "Late deliverable confirmation"],
        rootCause: "Tone shifted from confident to defensive after budget discussion.",
        fixes: [
            { text: "Use suggested pricing script", actionType: "redirect", target: "/settings" },
            { text: "Respond within 6 hours", actionType: "guide", target: "/profile" }
        ],
        prediction: 71,
        comparison: {
            clarity: { past: 50, current: 90 },
            reliability: { past: 30, current: 80 },
            trust: { past: 45, current: 85 }
        }
    };

    const handleFixExecution = (fix) => {
        if (!fix) return;

        if (fix.actionType === 'redirect') {
            onClose(); // Close the Nuro Dashboard
            navigate(fix.target);
        } else if (fix.actionType === 'guide') {
            onClose();
            navigate(fix.target); // Navigate to where they need to go
            // Ideally trigger a toast or highlight: "Fix it here"
        } else {
            // Placeholder for custom guidance logic
            alert(`Nuro will help you fix: ${fix.text}`);
        }
    };

    return (
        <div className="nuro-dashboard-overlay">
            <motion.div
                className="nuro-window"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                {/* 1. STATUS BAR */}
                <div className="nuro-status-bar">
                    <div className="nuro-logo">✨ NURO CORE</div>
                    <div className="nuro-mode-indicator">
                        <span
                            className={`nuro-mode ${activeMode === 'active' ? 'active' : ''}`}
                            onClick={() => handleModeClick('active')}
                            style={{ cursor: 'pointer' }}
                        >
                            Active
                        </span>
                        <span className="separator">|</span>
                        <span
                            className={`nuro-mode ${activeMode === 'learning' ? 'active' : ''}`}
                            onClick={() => handleModeClick('learning')}
                            style={{ cursor: 'pointer' }}
                        >
                            Learning
                        </span>
                        <span className="separator">|</span>
                        <span
                            className={`nuro-mode ${activeMode === 'advising' ? 'active' : ''}`}
                            onClick={() => handleModeClick('advising')}
                            style={{ cursor: 'pointer' }}
                        >
                            Advising
                        </span>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                {/* 2. MAIN CONTENT (Animated Transition) */}
                <div className="nuro-content">
                    <AnimatePresence mode="wait">
                        {/* ACTIVE MODE - LIVE MONITORING */}
                        {activeMode === 'active' && (
                            <motion.div
                                key="active"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="active-mode-container"
                                style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
                            >
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
                            </motion.div>
                        )}

                        {/* LEARNING MODE - ANALYTICS */}
                        {activeMode === 'learning' && (
                            <motion.div
                                key="learning"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="nuro-learning-grid"
                            >
                                {/* LEFT: SCORES */}
                                <div className="nuro-left-col">
                                    <div className="nuro-score-panel">
                                        <h4>Growth Analysis</h4>
<<<<<<< HEAD
=======
                                        <ScoreRing score={data.score} delta={data.delta} />

                                        {/* COMPARISON UI */}
                                        <div className="nuro-card" style={{ marginTop: '2rem' }}>
                                            <h4>Improvement vs Regression</h4>
                                            <ComparisonBar label="Communication Clarity" past={data.comparison.clarity.past} current={data.comparison.clarity.current} delay={0.2} />
                                            <ComparisonBar label="Reliability Score" past={data.comparison.reliability.past} current={data.comparison.reliability.current} delay={0.4} />
                                            <ComparisonBar label="Trust Index" past={data.comparison.trust.past} current={data.comparison.trust.current} delay={0.6} />
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT: DEEP DIVE */}
                                <div className="nuro-analysis-panel">
                                    <motion.div
                                        className="nuro-card"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.8 }}
                                    >
                                        <h4>Why It Happened? (Root Cause)</h4>
                                        <motion.p
                                            style={{ fontSize: '1.1rem', color: '#fbbf24', lineHeight: '1.6' }}
                                            animate={{ opacity: [1, 0.8, 1] }}
                                            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 2 }}
                                        >
                                            "{data.rootCause}"
                                        </motion.p>
                                    </motion.div>

                                    <motion.div
                                        className="nuro-card"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 1 }}
                                    >
                                        <h4>What Changed Since Last Time?</h4>
                                        <ul className="analysis-list">
                                            <li><span className="pos-icon">✓</span> Response time improved by 40%</li>
                                            <li><span className="neg-icon">⚠</span> Tone became defensive earlier in the chat</li>
                                        </ul>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}

                        {/* ADVISING MODE - FIXES */}
                        {activeMode === 'advising' && (
                            <motion.div
                                key="advising"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '0 2rem' }}
                            >
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
                                                <div
                                                    key={i}
                                                    className="action-checkbox"
                                                    style={{
                                                        padding: '1.2rem',
                                                        background: 'rgba(15, 23, 42, 0.4)',
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        borderRadius: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '15px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                        <span style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.9)' }}>{fix.text}</span>
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleFixExecution(fix);
                                                        }}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            background: 'rgba(52, 211, 153, 0.1)',
                                                            border: '1px solid #34d399',
                                                            borderRadius: '6px',
                                                            color: '#34d399',
                                                            fontWeight: '600',
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.target.style.background = '#34d399';
                                                            e.target.style.color = '#000';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.target.style.background = 'rgba(52, 211, 153, 0.1)';
                                                            e.target.style.color = '#34d399';
                                                        }}
                                                    >
                                                        Fix
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>

    );
}

// ------------------------------------------------------------------
// ANIMATED SUB-COMPONENTS
// ------------------------------------------------------------------

// 3. CIRCULAR SCORE RING ANIMATION
function ScoreRing({ score, delta }) {
    // Animate score from 0 to target
    const scoreVal = useMotionValue(0);

    useEffect(() => {
        const timeout = setTimeout(() => {
            scoreVal.set(score);
        }, 100);
        return () => clearTimeout(timeout);
    }, [score, scoreVal]);

    // Use a spring transition for the number to count up
    const displayScore = useSpring(0, { bounce: 0, duration: 1500 });

    useEffect(() => {
        displayScore.set(score);
    }, [score, displayScore]);

    // For the ring gradient
    const ringSpring = useSpring(0, { bounce: 0, duration: 1500 });
    useEffect(() => ringSpring.set(score), [score, ringSpring]);

    const ringBackground = useTransform(ringSpring, (v) =>
        `conic-gradient(var(--nuro-blue) ${v}%, rgba(255, 255, 255, 0.1) 0)`
    );

    return (
        <div className="score-ring" style={{ position: 'relative' }}>
            {/* The Gradient Ring */}
            <motion.div
                style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: ringBackground
                }}
            />

            <div className="score-inner" style={{ position: 'relative', zIndex: 1 }}>
                <motion.span className="score-val">
                    {useDigitMotion(displayScore)}
                </motion.span>
                <motion.span
                    className="score-delta"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2, duration: 0.5 }}
                >
                    ▲ +{delta}%
                </motion.span>
            </div>
        </div>
    );
}

// Helper to render motion value as text
function useDigitMotion(motionValue) {
    const [value, setValue] = useState(0);
    useEffect(() => motionValue.on("change", (latest) => setValue(Math.round(latest))), [motionValue]);
    return value;
}


// 2. PROGRESS BAR FILL ANIMATION
function ComparisonBar({ label, past, current, delay }) {
    return (
        <div className="comp-bar-row">
            <div className="comp-bar-label">
                <span>{label}</span>
                <span>{current}/100</span>
            </div>
            <div className="comp-track">
                {/* Past - Ghost Bar */}
                <motion.div
                    className="comp-fill past"
                    initial={{ width: 0 }}
                    animate={{ width: `${past}%` }}
                    transition={{ duration: 0.8, delay: delay, ease: "easeOut" }}
                />

                {/* Current - Solid Bar */}
                <motion.div
                    className="comp-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${current}%` }}
                    transition={{ duration: 1.2, delay: delay + 0.2, ease: "easeInOut" }}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '0.7rem', opacity: 0.5 }}>
                <span>Last: {past}</span>
                <span>Now: {current}</span>
            </div>
        </div>
    );

                                        {/* Animated Score Ring */}
>>>>>>> 1a926e0ae22d66b6bd1d2a85eb13997ff15d5fad
                                        <ScoreRing score={data.score} delta={data.delta} />

                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 1, duration: 0.8 }}
                                            className="educational-note"
                                            style={{ marginTop: '2rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}
                                        >
                                            "You negotiated better than last time, but listened less."
                                        </motion.div>

                                        {/* COMPARISON UI */}
                                        <div className="nuro-card" style={{ marginTop: '2rem' }}>
                                            <h4>Improvement vs Regression</h4>
                                            <ComparisonBar label="Communication Clarity" past={data.comparison.clarity.past} current={data.comparison.clarity.current} delay={0.2} />
                                            <ComparisonBar label="Reliability Score" past={data.comparison.reliability.past} current={data.comparison.reliability.current} delay={0.4} />
                                            <ComparisonBar label="Trust Index" past={data.comparison.trust.past} current={data.comparison.trust.current} delay={0.6} />
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT: DEEP DIVE */}
                                <div className="nuro-analysis-panel">
                                    <motion.div
                                        className="nuro-card"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.8 }}
                                    >
                                        <h4>Why It Happened? (Root Cause)</h4>
                                        <motion.p
                                            style={{ fontSize: '1.1rem', color: '#fbbf24', lineHeight: '1.6' }}
                                            animate={{ opacity: [1, 0.8, 1] }}
                                            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 2 }}
                                        >
                                            "{data.rootCause}"
                                        </motion.p>
                                    </motion.div>

                                    <motion.div
                                        className="nuro-card"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 1 }}
                                    >
                                        <h4>What Changed Since Last Time?</h4>
                                        <ul className="analysis-list">
                                            <li><span className="pos-icon">✓</span> Response time improved by 40%</li>
                                            <li><span className="neg-icon">⚠</span> Tone became defensive earlier in the chat</li>
                                        </ul>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}

                        {activeMode === 'advising' && (
                            <motion.div
                                key="advising"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '0 2rem' }}
                            >
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
                                            <p style={{ fontSize: '1.1rem', color: 'white', marginTop: '0.5rem', lineHeight: '1.6', fontStyle: 'italic' }}>"{data.rootCause}"</p>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>Impact</label>
                                            <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem' }}>This caused a friction point in the negotiation phase, lowering trust score by 15%.</p>
                                        </div>
                                    </div>

                                    {/* RIGHT: SOLUTION PROTOCOL */}
                                    <div className="nuro-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <h4 style={{ marginBottom: '1.5rem' }}>Recommended Solution Protocol</h4>
                                        <div style={{ display: 'grid', gap: '1rem', flex: 1 }}>
                                            {data.fixes.map((fix, i) => (
                                                <div
                                                    key={i}
                                                    className="action-checkbox"
                                                    style={{
                                                        padding: '1.2rem',
                                                        background: 'rgba(15, 23, 42, 0.4)',
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        borderRadius: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '15px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                        <span style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.9)' }}>{fix.text}</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleFixExecution(fix);
                                                        }}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            background: 'rgba(52, 211, 153, 0.1)',
                                                            border: '1px solid #34d399',
                                                            borderRadius: '6px',
                                                            color: '#34d399',
                                                            fontWeight: '600',
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.target.style.background = '#34d399';
                                                            e.target.style.color = '#000';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.target.style.background = 'rgba(52, 211, 153, 0.1)';
                                                            e.target.style.color = '#34d399';
                                                        }}
                                                    >
                                                        Fix
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

// ------------------------------------------------------------------
// ANIMATED SUB-COMPONENTS
// ------------------------------------------------------------------

// 3. CIRCULAR SCORE RING ANIMATION
function ScoreRing({ score, delta }) {
    // Animate score from 0 to target
    const scoreVal = useMotionValue(0);

    useEffect(() => {
        const timeout = setTimeout(() => {
            scoreVal.set(score);
        }, 100);
        return () => clearTimeout(timeout);
    }, [score, scoreVal]);

    // Use a spring transition for the number to count up
    const displayScore = useSpring(0, { bounce: 0, duration: 1500 });

    useEffect(() => {
        displayScore.set(score);
    }, [score, displayScore]);

    // For the ring gradient
    const ringSpring = useSpring(0, { bounce: 0, duration: 1500 });
    useEffect(() => ringSpring.set(score), [score, ringSpring]);

    const ringBackground = useTransform(ringSpring, (v) =>
        `conic-gradient(var(--nuro-blue) ${v}%, rgba(255, 255, 255, 0.1) 0)`
    );

    return (
        <div className="score-ring" style={{ position: 'relative' }}>
            {/* The Gradient Ring */}
            <motion.div
                style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: ringBackground
                }}
            />

            <div className="score-inner" style={{ position: 'relative', zIndex: 1 }}>
                <motion.span className="score-val">
                    {useDigitMotion(displayScore)}
                </motion.span>
                <motion.span
                    className="score-delta"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2, duration: 0.5 }}
                >
                    ▲ +{delta}%
                </motion.span>
            </div>
        </div>
    );
}

// Helper to render motion value as text
function useDigitMotion(motionValue) {
    const [value, setValue] = useState(0);
    useEffect(() => motionValue.on("change", (latest) => setValue(Math.round(latest))), [motionValue]);
    return value;
}


// 2. PROGRESS BAR FILL ANIMATION
function ComparisonBar({ label, past, current, delay }) {
    return (
        <div className="comp-bar-row">
            <div className="comp-bar-label">
                <span>{label}</span>
                <span>{current}/100</span>
            </div>
            <div className="comp-track">
                {/* Past - Ghost Bar */}
                <motion.div
                    className="comp-fill past"
                    initial={{ width: 0 }}
                    animate={{ width: `${past}%` }}
                    transition={{ duration: 0.8, delay: delay, ease: "easeOut" }}
                />

                {/* Current - Solid Bar */}
                <motion.div
                    className="comp-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${current}%` }}
                    transition={{ duration: 1.2, delay: delay + 0.2, ease: "easeInOut" }}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '0.7rem', opacity: 0.5 }}>
                <span>Last: {past}</span>
                <span>Now: {current}</span>
            </div>
        </div>
    );
}
