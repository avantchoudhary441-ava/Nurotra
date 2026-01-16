import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import '../modals/premiumModals.css';

/**
 * LockedMatchCard - A locked card overlay component
 * Shows blur + lock + price badge
 * Clicking triggers the unlock modal
 */
const LockedMatchCard = ({ onUnlockClick, cardVariants }) => {
    const { formatCurrency } = useCurrency();

    return (
        <motion.div
            className="card-wrapper locked-match-card"
            variants={cardVariants}
            onClick={onUnlockClick}
        >
            <div className="premium-card">
                {/* Locked Overlay */}
                <div className="locked-overlay">
                    <div className="locked-icon-circle">
                        <Lock size={32} className="lock-icon" />
                    </div>
                    <span className="unlock-price">Unlock for {formatCurrency(9)}</span>
                    <span className="unlock-hint">Authorization Required</span>
                </div>

                {/* Blurred placeholder content */}
                <div style={{
                    opacity: 0.3,
                    filter: 'blur(8px)',
                    pointerEvents: 'none'
                }}>
                    <div
                        className="card-avatar"
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.2))',
                            margin: '0 auto 15px'
                        }}
                    />
                    <h3 className="card-name" style={{ color: 'rgba(255,255,255,0.5)' }}>Hidden Match</h3>
                    <div className="card-match-score">Match Accuracy - ???</div>
                    <div className="card-meta">
                        <div className="meta-row">
                            <span className="meta-label">Niche:</span>
                            <span className="meta-value">••••••</span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">Details:</span>
                            <span className="meta-value">••••••</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default LockedMatchCard;
