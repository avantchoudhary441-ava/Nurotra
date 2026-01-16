import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Lock, X, Gift, Search, Cpu } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import AgentCard from '../AgentCard'; // Using existing agent card for result

const MatchFlowModal = ({ isOpen, onClose, role }) => {
    const { formatCurrency } = useCurrency();
    const [step, setStep] = useState('CHECK'); // CHECK, LOADING, RESULT, PREMIUM_1, PREMIUM_2, PREMIUM_3
    const [loadingText, setLoadingText] = useState('Initializing AI...');

    // Mock Match Data
    const bestMatch = {
        _id: 'best_match_1',
        name: role === 'influencer' ? 'FitFuel Nutrition' : 'Aria Sky (Fitness)',
        category: role === 'influencer' ? 'Health & Wellness' : 'Lifestyle',
        description: 'Perfect alignment with your DNA profile and audience demographics.',
        matchRate: 98,
        tags: ['Premium', 'High ROI'],
        role: role === 'influencer' ? 'brand' : 'influencer'
    };

    const hasUsedFree = localStorage.getItem('hasUsedFreeMatchFlow') === 'true';

    useEffect(() => {
        if (!isOpen) return;

        if (step === 'CHECK') {
            if (!hasUsedFree) {
                setStep('LOADING');
            } else {
                setStep('PREMIUM_1');
            }
        }

        if (step === 'LOADING') {
            const texts = [
                'Scanning Market Dynamics...',
                'Analyzing DNA Profile...',
                'Fetching Optimal Alignments...',
                'Found Your Best Match!'
            ];
            let i = 0;
            const interval = setInterval(() => {
                if (i < texts.length) {
                    setLoadingText(texts[i]);
                    i++;
                } else {
                    clearInterval(interval);
                    setStep('RESULT');
                    localStorage.setItem('hasUsedFreeMatchFlow', 'true');
                }
            }, 800);
            return () => clearInterval(interval);
        }
    }, [isOpen, step, hasUsedFree]);

    if (!isOpen) return null;

    const resetAndClose = () => {
        setStep('CHECK');
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                className="premium-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={resetAndClose}
            >
                <motion.div
                    className={`premium-modal-card match-flow-modal ${step === 'RESULT' ? 'wide' : ''}`}
                    initial={{ scale: 0.9, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 30 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className="modal-close-btn" onClick={resetAndClose}><X size={20} /></button>

                    {/* STEP: LOADING */}
                    {step === 'LOADING' && (
                        <div className="match-flow-loading">
                            <div className="loader-orbit">
                                <Cpu size={40} className="cpu-icon" />
                                <div className="orbit-ring"></div>
                            </div>
                            <h2 className="loading-title">{loadingText}</h2>
                            <p>Nuro is curating your highest potential collaboration...</p>
                        </div>
                    )}

                    {/* STEP: RESULT */}
                    {step === 'RESULT' && (
                        <div className="match-flow-result">
                            <div className="match-stars">
                                <Sparkles size={24} color="#facc15" />
                                <h3>AI REVEAL: BEST MATCH FOUND</h3>
                                <Sparkles size={24} color="#facc15" />
                            </div>
                            <div className="result-spotlight">
                                <AgentCard agent={bestMatch} isMatch={true} />
                            </div>
                            <p className="match-disclaimer">This match is highly compatible with your professional DNA.</p>
                            <button className="btn-primary" style={{ marginTop: '20px' }} onClick={resetAndClose}>
                                Save & Close
                            </button>
                        </div>
                    )}

                    {/* PREMIUM STEPS */}
                    {step === 'PREMIUM_1' && (
                        <div className="modal-content step-1">
                            <div className="modal-icon-wrapper"><Lock size={24} className="lock-icon" /></div>
                            <h2 className="modal-title">Premium Scan</h2>
                            <p className="modal-body">Trial session concluded. Requesting authorization for next AI-curated Best Match.</p>
                            <div className="modal-actions">
                                <button className="btn-primary" onClick={() => setStep('PREMIUM_2')}>
                                    Authorize for {formatCurrency(9)}
                                </button>
                                <button className="btn-secondary" onClick={resetAndClose}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {step === 'PREMIUM_2' && (
                        <div className="modal-content step-2">
                            <div className="modal-icon-wrapper pulse"><Sparkles size={24} className="sparkle-icon" /></div>
                            <h2 className="modal-title">Confirm Scan</h2>
                            <p className="modal-body">Initiating high-precision partnership alignment scan.</p>
                            <div className="modal-actions">
                                <button className="btn-primary" onClick={() => setStep('PREMIUM_3')}>Proceed ({formatCurrency(9)})</button>
                                <button className="btn-secondary" onClick={() => setStep('PREMIUM_1')}>Back</button>
                            </div>
                        </div>
                    )}

                    {step === 'PREMIUM_3' && (
                        <div className="modal-content step-3">
                            <div className="modal-icon-wrapper success"><Gift size={30} className="success-icon" /></div>
                            <h2 className="modal-title success-title">Authorization Success</h2>
                            <p className="modal-body thank-you-body">No charge applied. Scan sequence ready for execution.</p>
                            <button className="btn-primary" onClick={() => setStep('LOADING')}>Execute Scan</button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default MatchFlowModal;
