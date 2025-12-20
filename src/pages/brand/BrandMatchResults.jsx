import React from "react";
import "../../styles/matchingForms.css";

export default function BrandMatchResults({ matches, onClose }) {
    if (!matches) return null;

    return (
        <div className="match-results-overlay">
            <div className="match-results-container">
                <div className="match-header">
                    <h2>Top Matches Found</h2>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <div className="matches-list">
                    {matches.map((inf, idx) => (
                        <div key={idx} className="match-card">
                            <div className="match-score">
                                <span className="score-val">{inf.matchScore}%</span>
                                <span className="score-label">Match</span>
                            </div>

                            <div className="match-info">
                                <h3>{inf.fullName || inf.socialHandle || "Influencer"}</h3>
                                <p className="match-role">{inf.niche} • {inf.primaryPlatform}</p>
                                <div className="match-stats">
                                    <span>👥 {inf.followers}</span>
                                    <span>⚡ {inf.engagementRate}% Eng.</span>
                                </div>
                            </div>

                            <div className="match-actions">
                                <button className="btn-primary-sm">Connect</button>
                            </div>
                        </div>
                    ))}

                    {matches.length === 0 && (
                        <div className="no-matches">
                            <p>No matches found yet. Try adjusting your filters.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
