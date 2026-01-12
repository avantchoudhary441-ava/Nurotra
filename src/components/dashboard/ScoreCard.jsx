import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function ScoreCard({ title, score, subtitle, history, info, delay = 0 }) {
    const [showInfo, setShowInfo] = useState(false);

    // Determine color based on score
    const getScoreColor = (s) => {
        if (s >= 80) return '#34d399'; // Green
        if (s >= 60) return '#fbbf24'; // Yellow
        return '#f87171'; // Red
    };

    const scoreColor = getScoreColor(score);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay, duration: 0.5 }}
            className="score-card"
            style={{
                background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
                borderLeft: `4px solid ${scoreColor}`,
                padding: '1rem',
                borderRadius: '8px',
                position: 'relative',
                marginBottom: '1rem'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h4 className="score-card-title">
                    {title}
                </h4>
                <div
                    style={{ cursor: 'pointer', opacity: 0.5, fontSize: '0.9rem', color: 'var(--text-primary)' }}
                    onMouseEnter={() => setShowInfo(true)}
                    onMouseLeave={() => setShowInfo(false)}
                >
                    ⓘ
                    {showInfo && (
                        <div style={{
                            position: 'absolute',
                            right: '0',
                            top: '24px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--card-border)',
                            padding: '10px',
                            borderRadius: '6px',
                            width: '200px',
                            zIndex: 10,
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                            fontSize: '0.75rem',
                            color: 'var(--text-primary)',
                            lineHeight: '1.4'
                        }}>
                            {info}
                        </div>
                    )}
                </div>
            </div>

            <p className="score-card-subtitle">
                {subtitle}
            </p>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span className="score-value">{score}</span>
                {history && (
                    <div style={{ fontSize: '0.8rem', color: history.trend === 'up' ? '#34d399' : history.trend === 'down' ? '#f87171' : 'var(--sub-text)' }}>
                        {history.trend === 'up' ? '▲' : history.trend === 'down' ? '▼' : '━'} {history.label}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
