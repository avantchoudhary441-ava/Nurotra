import React from "react";
import "../../styles/matchingForms.css";

export default function InfluencerMatchResults({ matches, onClose }) {
    if (!matches) return null;

    return (
        <div className="match-results-overlay">
            <div className="match-results-container">
                <div className="match-header">
                    <h2>Top Brand Matches</h2>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <div className="matches-list">
                    {matches.map((brand, idx) => (
                        <div key={idx} className="match-card">
                            <div className="match-score">
                                <span className="score-val">{brand.matchScore}%</span>
                                <span className="score-label">Match</span>
                            </div>

                            <div className="match-info">
                                <h3>{brand.brandName || "Brand"}</h3>
                                <p className="match-role">{brand.industry} • {brand.companyType || "Company"}</p>
                                <div className="match-stats">
                                    <span>💰 {brand.budget}</span>
                                    <span>🎯 {brand.campaignGoal}</span>
                                </div>
                            </div>

                            <div className="match-actions">
                                <button className="btn-primary-sm">Apply</button>
                            </div>
                        </div>
                    ))}

                    {matches.length === 0 && (
                        <div className="no-matches">
                            <p>No matches found yet. Try adjusting your preferences.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
