import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/nuro.css';
import { nuroService } from '../../services/apiService';

export default function NuroLab({ isOpen, toggleLab }) {
    const [memory, setMemory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tone, setTone] = useState('calm'); // 'calm', 'serious', 'encouraging'

    useEffect(() => {
        if (isOpen) {
            fetchNuroMemory();
        }
    }, [isOpen]);

    const fetchNuroMemory = async () => {
        try {
            setLoading(true);
            const data = await nuroService.getMemory();
            processInsights(data);
        } catch (error) {
            console.error("Failed to load Nuro Lab Sidebar:", error);
            // Optional: fallback to empty structure instead of mock
            processInsights({ metrics: { communicationClarity: 50 }, collabHistory: [] });
        } finally {
            setLoading(false);
        }
    };

    const processInsights = (data) => {
        // Logic to determine tone based on trend
        const history = data.collabHistory || [];
        const recent = history.slice(-7); // Last 7

        if (recent.length > 1) {
            const last = recent[recent.length - 1].overallScore;
            const prev = recent[recent.length - 2].overallScore;

            if (last < prev - 10) setTone('serious');
            else if (last > prev + 5) setTone('encouraging');
            else setTone('calm');
        } else {
            setTone('calm');
        }

        setMemory({ ...data, history: recent.reverse() }); // Newest first
    };

    const getToneColor = () => {
        switch (tone) {
            case 'serious': return '#ef4444'; // Red
            case 'encouraging': return '#34d399'; // Green
            case 'calm': default: return '#60a5fa'; // Blue
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="nuro-lab-sidebar"
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 20 }}
                >
                    <div className="lab-header" style={{ borderBottomColor: getToneColor() }}>
                        <h3>🧪 Nuro Lab</h3>
                        <div className="tone-badge" style={{ background: getToneColor(), color: '#000' }}>
                            {tone.toUpperCase()} MODE
                        </div>
                        <button className="close-lab" onClick={toggleLab}>→</button>
                    </div>

                    <div className="lab-content">
                        {loading ? (
                            <div className="lab-loading">Analyzing patterns...</div>
                        ) : (
                            <>
                                {/* 1. IDENTITY SNAPSHOT */}
                                <div className="lab-section identity">
                                    <label>Current Identity</label>
                                    <div className="identity-stats">
                                        <div className="stat-box">
                                            <span className="lbl">Clarity</span>
                                            <span className="val">{Math.round(memory?.metrics?.communicationClarity || 0)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. RECENT SESSIONS */}
                                <div className="lab-section history">
                                    <label>Recent 7 Observations</label>
                                    <div className="history-list">
                                        {memory?.history?.map((item, i) => (
                                            <div key={i} className="history-card">
                                                <div className="h-header">
                                                    <span className="h-score" style={{ color: item.overallScore > 70 ? '#34d399' : '#f87171' }}>
                                                        {item.overallScore}%
                                                    </span>
                                                    <span className="h-date">{new Date(item.timestamp).toLocaleDateString()}</span>
                                                </div>
                                                <div className="h-insight">
                                                    {item.rootCause ? `"${item.rootCause}"` : "No specific anomaly detected."}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. MENTOR NOTE */}
                                <div className="lab-section mentor-note">
                                    <label>Nuro's Note</label>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: '1.5' }}>
                                        {tone === 'serious' && "You are repeating the same mistake with pricing. We need to fix this pattern now."}
                                        {tone === 'encouraging' && "Excellent progress on response time. Your performance is climbing fast."}
                                        {tone === 'calm' && "Steady performance. Let's focus on refining your closing statements next."}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
