import React from 'react';
import '../styles/LoginModal.css';
import { useNavigate } from 'react-router-dom';

export default function LoginModal({ isOpen, onClose }) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleLogin = () => {
        navigate('/login');
        onClose();
    };

    // Close when clicking outside
    const handleOverlayClick = (e) => {
        if (e.target.className === 'login-modal-overlay') {
            onClose();
        }
    };

    return (
        <div className="login-modal-overlay" onClick={handleOverlayClick}>
            <div className="login-modal-content">
                <h2 className="login-modal-title">Access Restricted 🔒</h2>
                <p className="login-modal-text">
                    Before moving further, please log in to access this feature and manage your dashboard.
                </p>
                <div className="login-modal-actions">
                    <button className="btn-modal-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn-modal-login" onClick={handleLogin}>
                        Log In / Sign Up
                    </button>
                </div>
            </div>
        </div>
    );
}
