import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Sparkles, Gift } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import './premiumModals.css';

/**
 * UnlockMatchModal - 3-step intercept flow for locked match cards
 * Step 1: Unlock Additional Match Modal
 * Step 2: Confirmation Screen
 * Step 3: Match Unlocked Thank You
 */
const UnlockMatchModal = ({ isOpen, onClose, onUnlock }) => {
    const { formatCurrency } = useCurrency();
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
                                <Lock size={24} className="lock-icon" />
                            </div>
                            <h2 className="modal-title">Access Match</h2>
                            <p className="modal-body">
                                Unlock this curated premium alignment for your profile.
                            </p>
                            <div className="modal-actions">
                                <button className="btn-primary" onClick={handleUnlockClick}>
                                    Unlock for {formatCurrency(9)}
                                </button>
                                <button className="btn-secondary" onClick={handleNotNow}>
                                    Decline
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Confirmation */}
                    {step === 2 && (
                        <div className="modal-content step-2">
                            <div className="modal-icon-wrapper pulse">
                                <Sparkles size={24} className="sparkle-icon" />
                            </div>
                            <h2 className="modal-title">Confirm Access</h2>
                            <p className="modal-body">
                                Submitting request for premium match access.
                            </p>
                            <div className="modal-actions">
                                <button className="btn-primary" onClick={handleProceed}>
                                    Proceed ({formatCurrency(9)})
                                </button>
                                <button className="btn-secondary" onClick={() => setStep(1)}>
                                    Back
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Match Unlocked (Manual Close) */}
                    {step === 3 && (
                        <div className="modal-content step-3">
                            <div className="modal-icon-wrapper success">
                                <Gift size={30} className="success-icon" />
                            </div>
                            <h2 className="modal-title success-title">Access Granted</h2>
                            <p className="modal-body thank-you-body">
                                Transaction processed successfully.
                                <br />
                                <span className="highlight-success">Match reveal authorized.</span>
                            </p>
                            {/* Manual Close Button */}
                            <div className="modal-actions" style={{ marginTop: '20px' }}>
                                <button className="btn-primary" onClick={resetAndClose}>
                                    Reveal Match
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
