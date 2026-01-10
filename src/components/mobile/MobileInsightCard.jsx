import React from 'react';
import { motion } from 'framer-motion';

/**
 * MobileInsightCard - "The Hero Card"
 * Displays the single most important action/insight for the user.
 * Design Principal: "One Glance, One Action"
 */
export default function MobileInsightCard({ overallScore, topInsight }) {
    // Determine color based on score
    const getColor = (score) => {
        if (score >= 80) return '#4ade80'; // Green
        if (score >= 60) return '#facc15'; // Yellow
        return '#f87171'; // Red
    };

    const scoreColor = getColor(overallScore);

    return (
        <div className="mobile-hero-container">
            {/* 1. Health Ring (Simplified Graph) */}
            <div className="mobile-health-ring">
                <svg viewBox="0 0 36 36" className="circular-chart">
                    <path className="circle-bg"
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#eee"
                        strokeWidth="3"
                    />
                    <path className="circle"
                        strokeDasharray={`${overallScore}, 100`}
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={scoreColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                </svg>
                <div className="health-score-text">
                    <span className="score-val">{overallScore}</span>
                    <span className="score-label">Health</span>
                </div>
            </div>

            {/* 2. The One Action */}
            <div className="mobile-hero-content">
                <h3 className="hero-insight-title">Nuro Suggests:</h3>
                <p className="hero-insight-text">
                    {topInsight?.text || "Keep up the good work! Your profile is looking great."}
                </p>
                {topInsight?.actionLabel && (
                    <button className="mobile-action-btn">
                        {topInsight.actionLabel} ➜
                    </button>
                )}
            </div>
        </div>
    );
}
