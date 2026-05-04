import React from 'react';

const ThinkingIndicator = ({ message = "Nurotra is thinking..." }) => {
    return (
        <div className="thinking-indicator">
            <div className="thinking-leaf">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L14.5 9H21L16 14L18 21L12 17L6 21L8 14L3 9H9.5L12 2Z" fill="url(#leafGradient)" />
                    <defs>
                        <linearGradient id="leafGradient" x1="12" y1="2" x2="12" y2="21" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#8B5CF6" />
                            <stop offset="1" stopColor="#EC4899" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <span>{message}</span>
        </div>
    );
};

export default ThinkingIndicator;
