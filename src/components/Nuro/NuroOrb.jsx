import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNuro } from '../../context/NuroContext';
import '../../styles/nuro.css';
import NuroDashboard from './NuroDashboard';

export default function NuroOrb() {
    const { orbState, insightMessage, toggleDashboard, showDashboard } = useNuro();

    return (
        <>
            <div className="nuro-orb-container" onClick={toggleDashboard}>
                <div className="nuro-bubble">
                    {insightMessage}
                </div>

                <motion.div
                    className={`nuro-orb ${orbState}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                >
                    <div className="orb-core"></div>
                </motion.div>
            </div>

            <AnimatePresence>
                {showDashboard && <NuroDashboard onClose={toggleDashboard} />}
            </AnimatePresence>
        </>
    );
}
