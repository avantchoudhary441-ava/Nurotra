import React from 'react';
import { motion } from 'framer-motion';

export default function InsightPanel({ insights, onAction }) {
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
                                padding: '2px 10px',
                                borderRadius: '4px',
                                fontWeight: '700'
                            }}>
                                {insight.category}
                            </span>
                            {insight.impact && (
                                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '600' }}>
                                    +{insight.impact}% Impact
                                </span>
                            )}
                        </div>

                        <p className="insight-text">
                            {insight.text}
                        </p>

                        <button
                            className="insight-btn"
                            onClick={() => onAction && onAction(insight.actionLabel)}
                        >
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
        case 'Growth': return '#10b981'; // Green
        case 'Collab': return '#3b82f6'; // Blue
        default: return '#9ca3af'; // Gray
    }
}

function getCategoryBg(category) {
    switch (category) {
        case 'Profile': return 'rgba(167, 139, 250, 0.15)';
        case 'Reliability': return 'rgba(244, 114, 182, 0.15)';
        case 'Growth': return 'rgba(16, 185, 129, 0.15)';
        case 'Collab': return 'rgba(59, 130, 246, 0.15)';
        default: return 'rgba(156, 163, 175, 0.15)';
    }
}
