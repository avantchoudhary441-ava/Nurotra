import React from 'react';
import { motion } from 'framer-motion';

export default function InsightPanel({ insights }) {
    if (!insights || insights.length === 0) return null;

    return (
        <div className="insight-panel">
            <h3>
                <span style={{ fontSize: '1.2rem' }}>💡</span>
                Actionable Insights
            </h3>

            <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {insights.map((insight, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="insight-card"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="insight-category" style={{
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: getCategoryColor(insight.category),
                                background: getCategoryBg(insight.category),
                                padding: '2px 8px',
                                borderRadius: '4px'
                            }}>
                                {insight.category}
                            </span>
                            {insight.impact && (
                                <span style={{ fontSize: '0.8rem', color: '#10b981' }}>
                                    +{insight.impact}% Impact
                                </span>
                            )}
                        </div>

                        <p className="insight-text">
                            {insight.text}
                        </p>

                        <button className="insight-btn">
                            {insight.actionLabel || "Take Action"} →
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function getCategoryColor(category) {
    switch (category) {
        case 'Profile': return '#a78bfa'; // Purple
        case 'Reliability': return '#f472b6'; // Pink
        case 'Growth': return '#34d399'; // Green
        default: return '#9ca3af'; // Gray
    }
}

function getCategoryBg(category) {
    switch (category) {
        case 'Profile': return 'rgba(167, 139, 250, 0.1)';
        case 'Reliability': return 'rgba(244, 114, 182, 0.1)';
        case 'Growth': return 'rgba(52, 211, 153, 0.1)';
        default: return 'rgba(156, 163, 175, 0.1)';
    }
}
