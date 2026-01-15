import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Phone, X, Sparkles, CheckCircle } from 'lucide-react';
import './premiumModals.css';

/**
 * PremiumCallModal - 3-step intercept flow for Call feature
 * Step 1: Premium Intercept Modal
 * Step 2: Confirmation Screen
 * Step 3: Thank You Screen
 */
const PremiumCallModal = ({ isOpen, onClose, onProceed, targetName }) => {
    const [step, setStep] = useState(1);
    const [tracking, setTracking] = useState({
        call_unlock_clicked: false,
        call_payment_proceed_clicked: false,
        call_intent_confirmed: false
    });

    const handleUnlockClick = () => {
        setTracking(prev => ({ ...prev, call_unlock_clicked: true }));
        console.log('[Nurotra Analytics] call_unlock_clicked = true');
        setStep(2);
    };

    const handleProceed = () => {
        setTracking(prev => ({ ...prev, call_payment_proceed_clicked: true }));
        console.log('[Nurotra Analytics] call_payment_proceed_clicked = true');
        setStep(3);
    };

    const handleConfirmation = () => {
        setTracking(prev => ({ ...prev, call_intent_confirmed: true }));
        console.log('[Nurotra Analytics] call_intent_confirmed = true');
        // Brief delay for user to see the thank you, then proceed
        setTimeout(() => {
            onProceed();
            resetAndClose();
        }, 1500);
    };

    const resetAndClose = () => {
        setStep(1);
        onClose();
    };

    const handleNotInterested = () => {
        console.log('[Nurotra Analytics] call_unlock_dismissed');
        resetAndClose();
    };

    // Trigger handleConfirmation when reaching step 3
    React.useEffect(() => {
        if (step === 3) {
            handleConfirmation();
        }
    }, [step]);

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

                    {/* Step 1: Premium Intercept */}
                    {step === 1 && (
                        <div className="modal-content step-1">
                            <div className="modal-icon-wrapper">
                                <Lock size={40} className="lock-icon" />
                            </div>
                            <h2 className="modal-title">🔒 Premium Call Access</h2>
                            <p className="modal-body">
                                Direct calls help ensure serious, high-quality collaborations.
                                <br />
                                <span className="highlight">Unlock call access to continue.</span>
                            </p>
                            <div className="modal-actions">
                                <button className="btn-primary gradient-btn" onClick={handleUnlockClick}>
                                    <Phone size={18} /> Unlock Call – ₹9
                                </button>
                                <button className="btn-secondary" onClick={handleNotInterested}>
                                    Not interested
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
                                You're about to unlock premium call access on Nurotra.
                                {targetName && <><br /><span className="target-name">Calling: {targetName}</span></>}
                            </p>
                            <div className="modal-actions">
                                <button className="btn-primary gradient-btn" onClick={handleProceed}>
                                    Proceed (₹9)
                                </button>
                                <button className="btn-secondary" onClick={() => setStep(1)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Thank You */}
                    {step === 3 && (
                        <div className="modal-content step-3">
                            <div className="modal-icon-wrapper success">
                                <CheckCircle size={50} className="success-icon" />
                            </div>
                            <h2 className="modal-title success-title">✅ Thank you for trusting Nurotra</h2>
                            <p className="modal-body thank-you-body">
                                No money has been charged.
                                <br />
                                Your interest helps us prioritize premium features.
                                <br />
                                <span className="highlight-success">Call access will be enabled for you shortly — free of cost.</span>
                            </p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PremiumCallModal;
