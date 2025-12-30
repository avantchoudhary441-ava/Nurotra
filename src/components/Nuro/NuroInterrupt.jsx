import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNuro } from '../../context/NuroContext';
import '../../styles/nuro.css';

export default function NuroInterrupt() {
    const { interrupt, clearInterrupt } = useNuro();

    // Default auto-dismiss for non-critical
    useEffect(() => {
        if (interrupt && interrupt.type !== 'CRITICAL' && interrupt.duration) {
            const timer = setTimeout(clearInterrupt, interrupt.duration);
            return () => clearTimeout(timer);
        }
    }, [interrupt, clearInterrupt]);

    if (!interrupt) return null;

    const colors = {
        CRITICAL: '#fbbf24', // Amber/Warning
        APPRECIATION: '#34d399', // Green
        CLARIFICATION: '#60a5fa', // Blue
        PAUSE: '#f472b6' // Pink
    };

    const icons = {
        CRITICAL: '⚠️',
        APPRECIATION: '👏',
        CLARIFICATION: '🤔',
        PAUSE: '✋'
    };

    return (
        <AnimatePresence>
            <div className="nuro-interrupt-overlay">
                <motion.div
                    className="nuro-interrupt-card"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    style={{ borderLeft: `5px solid ${colors[interrupt.type] || 'white'}` }}
                >
                    <div className="interrupt-icon" style={{ background: colors[interrupt.type] }}>
                        {icons[interrupt.type]}
                    </div>
                    <div className="interrupt-content">
                        <h4>NURO INTERVENTION</h4>
                        <h3>{interrupt.title}</h3>
                        <p>{interrupt.message}</p>

                        {interrupt.actions && (
                            <div className="interrupt-actions">
                                {interrupt.actions.map((act, i) => (
                                    <button key={i} onClick={() => { act.onClick(); clearInterrupt(); }}>
                                        {act.label}
                                    </button>
                                ))}
                                <button className="dismiss-btn" onClick={clearInterrupt}>Dismiss</button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
