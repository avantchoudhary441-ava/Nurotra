import React, { useState, useEffect } from "react";
import "../../styles/nuro.css"; // We'll reuse nuro styles or add new ones
import { Link } from "react-router-dom";

// Mock Data for "Last 7 Matches"
const MOCK_HISTORY = [
    { id: 1, partner: "Brand A", outcome: "Success", score: 85, date: "2 days ago" },
    { id: 2, partner: "Brand B", outcome: "Failed", score: 42, date: "5 days ago" },
    { id: 3, partner: "Influencer X", outcome: "Success", score: 91, date: "1 week ago" },
    { id: 4, partner: "Tech Corp", outcome: "Keep", score: 60, date: "1 week ago" },
    { id: 5, partner: "Startup Z", outcome: "Success", score: 78, date: "2 weeks ago" },
    { id: 6, partner: "Agency Y", outcome: "Failed", score: 30, date: "2 weeks ago" },
    { id: 7, partner: "Brand C", outcome: "Success", score: 88, date: "3 weeks ago" },
];

export default function NuroLab() {
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
                        {MOCK_HISTORY.map((match) => (
                            <div key={match.id} className={`timeline-item ${match.outcome.toLowerCase()}`}>
                                <div className="timeline-dot"></div>
                                <div className="timeline-content">
                                    <h4>{match.partner}</h4>
                                    <span className="match-date">{match.date}</span>
                                </div>
                                <div className="timeline-score">
                                    {match.score}%
                                </div>
                            </div>
                        ))}
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
                                <div className="bar improvement" style={{ width: '80%' }}></div>
                                <span>Improving (More Direct)</span>
                            </div>
                            <p className="pattern-insight">You are becoming more assertive in negotiations.</p>
                        </div>

                        {/* Pressure Decision */}
                        <div className="pattern-card">
                            <h3>⚡ Decisions Under Pressure</h3>
                            <div className="pattern-visual pressure-visual">
                                <div className="bar regression" style={{ width: '40%' }}></div>
                                <span>Impulsive</span>
                            </div>
                            <p className="pattern-insight">Tendency to agree too quickly when rushed.</p>
                        </div>

                        {/* Mistakes Evolution */}
                        <div className="pattern-card">
                            <h3>🔄 Mistake Evolution</h3>
                            <ul className="mistake-list">
                                <li className="fading">
                                    <span className="icon">🌫️</span>
                                    <s>Late Replies</s> (Fading away...)
                                </li>
                                <li className="alert">
                                    <span className="icon">⚠️</span>
                                    Undefined Deliverables (Recurring)
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
