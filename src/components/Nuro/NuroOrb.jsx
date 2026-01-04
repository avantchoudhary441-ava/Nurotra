import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNuroCore } from '../../context/NuroCoreContext';
import '../../styles/nuro.css';
import NuroDashboard from './NuroDashboard';

export default function NuroOrb() {
    const { mode, activeInterrupt } = useNuroCore();
    const [isDashboardOpen, setDashboardOpen] = useState(false);

    // Orb State Mapping
    const getOrbState = () => {
        if (activeInterrupt) return 'alert';
        if (mode === 'learning' || mode === 'advising') return 'thinking';
        return 'default';
    };

    const toggleDashboard = () => setDashboardOpen(!isDashboardOpen);

    return (
        <>
            <div className="nuro-orb-container" onClick={toggleDashboard}>
                <div className="nuro-bubble">
                    {mode === 'observing' ? "Nuro is observing..." : `Mode: ${mode.toUpperCase()}`}
                </div>

                <motion.div
                    className={`nuro-orb ${getOrbState()}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                >
                    <div className="orb-core"></div>
                </motion.div>
            </div>

            <AnimatePresence>
                {isDashboardOpen && <NuroDashboard isOpen={isDashboardOpen} onClose={() => setDashboardOpen(false)} />}
            </AnimatePresence>
        </>
    );
}
