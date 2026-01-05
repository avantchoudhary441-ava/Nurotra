import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNuroCore } from '../../context/NuroCoreContext';
import '../../styles/nuro.css';

export default function NuroInterrupt() {
    const { activeInterrupt, dismissInterrupt, handleFeedback } = useNuroCore();
    const [displayedText, setDisplayedText] = useState("");
    const [isTextDone, setTextDone] = useState(false);

    // Typewriter Effect Logic
    useEffect(() => {
        if (activeInterrupt) {
            setDisplayedText("");
            setTextDone(false);
            let i = 0;
            const text = activeInterrupt.content || "";
            const speed = 30; // ms per char

            const typing = setInterval(() => {
                if (i < text.length) {
                    setDisplayedText((prev) => prev + text.charAt(i));
                    i++;
                } else {
                    clearInterval(typing);
                    setTextDone(true);
                }
            }, speed);

            return () => clearInterval(typing);
        }
    }, [activeInterrupt]);

    if (!activeInterrupt) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="nuro-signature-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* 1. ORB & THOUGHT CONTAINER */}
                <div className="signature-orb-container">

                    {/* THOUGHT BUBBLE (Appears after short delay) */}
                    <motion.div
                        className="nuro-thought-bubble"
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.8, duration: 0.5 }}
                    >
                        <div className="typewriter-text">
                            {displayedText}
                            <span className="cursor">|</span>
                        </div>

                        {/* ACTIONS (Appear after text is done) */}
                        {isTextDone && (
                            <motion.div
                                className="signature-actions"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                {activeInterrupt.options ? (
                                    activeInterrupt.options.map((opt, i) => (
                                        <button key={i} className="btn-signature" onClick={() => handleFeedback(opt)}>
                                            {opt}
                                        </button>
                                    ))
                                ) : (
                                    <button className="btn-signature" onClick={dismissInterrupt}>
                                        Got it
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </motion.div>

                    {/* THE ORB (Rises & Glows) */}
                    <motion.div
                        className="nuro-orb unusual-glow"
                        initial={{ y: 200, scale: 0.5 }}
                        animate={{ y: 0, scale: 1.5 }}
                        transition={{
                            type: "spring",
                            stiffness: 100,
                            damping: 20,
                            delay: 0.2
                        }}
                    >
                        <div className="orb-core"></div>
                    </motion.div>

                </div>
            </motion.div>
        </AnimatePresence>
    );
}
