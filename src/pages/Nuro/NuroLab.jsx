import React, { useState, useEffect } from "react";
import "../../styles/nuro.css"; // We'll reuse nuro styles or add new ones
import { Link } from "react-router-dom";
import { nuroService } from "../../services/apiService";

export default function NuroLab() {
    const [memory, setMemory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMemory = async () => {
            try {
                const data = await nuroService.getMemory();
                setMemory(data);
            } catch (err) {
                console.error("Failed to fetch Nuro history", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMemory();
    }, []);

    const history = memory?.collabHistory?.slice(-7).reverse() || [];
    const metrics = memory?.metrics || {
        communicationClarity: 50,
        reliabilityScore: 50,
        trustIndex: 50
    };

    if (loading) {
        return (
            <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '20px' }}>Accessing Nuro Memory...</p>
            </div>
        );
    }

    return (
        <div className="nuro-lab-container">
            {/* HEADER */}
            <header className="nuro-lab-header">
                <div className="lab-title">
                    <h1>Nuro Lab 🧪</h1>
                    <p>Your Behavioral Memory & Growth Center</p>
                </div>
            </header>

            <div className="nuro-lab-grid">
                {/* LEFT: MEMORY WINDOW (Last 7 Matches) */}
                <section className="lab-section memory-window">
                    <h2>🧠 Memory Window (Last 7)</h2>
                    <p className="subtext">Humans grow when feedback is recent & actionable.</p>

                    <div className="timeline-list">
                        {history.length > 0 ? history.map((match, index) => (
                            <div key={index} className={`timeline-item ${match.outcome.toLowerCase()}`}>
                                <div className="timeline-dot"></div>
                                <div className="timeline-content">
                                    <h4>{match.partnerName || "Anonymous Partner"}</h4>
                                    <span className="match-date">{new Date(match.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="timeline-score">
                                    {match.overallScore}%
                                </div>
                            </div>
                        )) : (
                            <div className="no-data-msg" style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
                                No recent collaborations found. Start matching to build memory!
                            </div>
                        )}
                    </div>
                </section>

                {/* RIGHT: BEHAVIORAL PATTERNS */}
                <section className="lab-section patterns-window">
                    <h2>🧬 Behavioral Patterns</h2>
                    <p className="subtext">Nuro understands you as a person, not data.</p>

                    <div className="pattern-cards">
                        {/* Tone Pattern */}
                        <div className="pattern-card">
                            <h3>🗣️ Communication Tone</h3>
                            <div className="pattern-visual tone-visual">
                                <div className="bar improvement" style={{ width: `${metrics.communicationClarity}%` }}></div>
                                <span>{metrics.communicationClarity > 60 ? "Clear & Strategic" : "Calibrating..."}</span>
                            </div>
                            <p className="pattern-insight">
                                {metrics.communicationClarity > 70
                                    ? "Your communication is highly professional and effective."
                                    : "Nuro is analyzing your tone for future optimizations."}
                            </p>
                        </div>

                        {/* Pressure Decision */}
                        <div className="pattern-card">
                            <h3>⚡ Reliability & Trust</h3>
                            <div className="pattern-visual pressure-visual">
                                <div className="bar success" style={{ width: `${metrics.reliabilityScore}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }}></div>
                                <span>{metrics.reliabilityScore}% Reliability</span>
                            </div>
                            <p className="pattern-insight">
                                {metrics.trustIndex > 75
                                    ? "High trust standing. Brands respond 2x faster to your offers."
                                    : "Building trust. Success rate improves as memory grows."}
                            </p>
                        </div>

                        {/* Mistakes Evolution */}
                        <div className="pattern-card">
                            <h3>🔄 Nuro Learnings</h3>
                            <ul className="mistake-list">
                                <li className={metrics.reliabilityScore > 80 ? "fading" : ""}>
                                    <span className="icon">{metrics.reliabilityScore > 80 ? "🌫️" : "🏗️"}</span>
                                    {metrics.reliabilityScore > 80 ? <s>Execution Lag</s> : "Analyzing Execution Time"}
                                    {metrics.reliabilityScore > 80 && " (Optimized)"}
                                </li>
                                <li className="alert">
                                    <span className="icon">🧠</span>
                                    Pattern Detection Active
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
