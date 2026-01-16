import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Sparkles, Gift } from 'lucide-react';
import './premiumModals.css';

/**
 * UnlockMatchModal - 3-step intercept flow for locked match cards
 * Step 1: Unlock Additional Match Modal
 * Step 2: Confirmation Screen
 * Step 3: Match Unlocked Thank You
 */
const UnlockMatchModal = ({ isOpen, onClose, onUnlock }) => {
    const [step, setStep] = useState(1);
    const [tracking, setTracking] = useState({
        match_unlock_clicked: false,
        match_payment_proceed_clicked: false
    });

    const handleUnlockClick = () => {
        setTracking(prev => ({ ...prev, match_unlock_clicked: true }));
        console.log('[Nurotra Analytics] match_unlock_clicked = true');
        setStep(2);
    };

    const handleProceed = () => {
        setTracking(prev => ({ ...prev, match_payment_proceed_clicked: true }));
        console.log('[Nurotra Analytics] match_payment_proceed_clicked = true');
        setStep(3);
    };

    // Modified: Logic to unlock ONLY when closing from Step 3
    const resetAndClose = () => {
        if (step === 3) {
            onUnlock(); // Trigger the actual unlock in parent
        }
        setStep(1);
        onClose();
    };

    const handleNotNow = () => {
        console.log('[Nurotra Analytics] match_unlock_dismissed');
        setStep(1); // Reset step just in case
        onClose();
    };

    if (!isOpen) return null;

    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
    };

    const modalVariants = {
        hidden: { opacity: 0, scale: 0.85, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
        exit: { opacity: 0, scale: 0.9, y: 20 }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="premium-modal-backdrop"
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onClick={resetAndClose}
            >
                <motion.div
                    className="premium-modal-card"
                    variants={modalVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button className="modal-close-btn" onClick={resetAndClose}>
                        <X size={20} />
                    </button>

                    {/* Step 1: Unlock Additional Match */}
                    {step === 1 && (
                        <div className="modal-content step-1">
                            <div className="modal-icon-wrapper">
                                <Lock size={40} className="lock-icon" />
                            </div>
                            <h2 className="modal-title">🔒 Unlock Additional Match</h2>
                            <p className="modal-body">
                                Unlock one additional high-quality match curated by Nuro.
                            </p>
                            <div className="modal-actions">
                                <button className="btn-primary gradient-btn" onClick={handleUnlockClick}>
                                    <Sparkles size={18} /> Unlock for ₹5
                                </button>
                                <button className="btn-secondary" onClick={handleNotNow}>
                                    Not now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Confirmation */}
                    {step === 2 && (
                        <div className="modal-content step-2">
                            <div className="modal-icon-wrapper pulse">
                                <Sparkles size={40} className="sparkle-icon" />
                            </div>
                            <h2 className="modal-title">Confirm Unlock</h2>
                            <p className="modal-body">
                                Proceed to unlock this match?
                            </p>
                            <div className="modal-actions">
                                <button className="btn-primary gradient-btn" onClick={handleProceed}>
                                    Proceed (₹5)
                                </button>
                                <button className="btn-secondary" onClick={() => setStep(1)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Match Unlocked (Manual Close) */}
                    {step === 3 && (
                        <div className="modal-content step-3">
                            <div className="modal-icon-wrapper success">
                                <Gift size={50} className="success-icon" />
                            </div>
                            <h2 className="modal-title success-title">🎉 Match Unlocked</h2>
                            <p className="modal-body thank-you-body">
                                No money has been charged.
                                <br />
                                Thanks for supporting Nurotra early.
                                <br />
                                <span className="highlight-success">This match has been unlocked for you — free of cost.</span>
                            </p>
                            {/* Manual Close Button */}
                            <div className="modal-actions" style={{ marginTop: '20px' }}>
                                <button className="btn-primary" onClick={resetAndClose}>
                                    Close & Reveal
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UnlockMatchModal;
