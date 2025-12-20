import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "../styles/growth-path.css";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function GrowthPathModal({ isOpen, onClose, initialType = 'success' }) {
    if (!isOpen) return null;

    const [currentSlide, setCurrentSlide] = useState(initialType === 'success' ? 0 : 1);

    // Reset slide when opening with a specific type
    useEffect(() => {
        setCurrentSlide(initialType === 'success' ? 0 : 1);
    }, [initialType, isOpen]);

    const slides = [
        {
            id: 'growth',
            title: "Growth Journey",
            color: "#22c55e", // Green
            data: [
                { label: "Contact", detail: "Initial reach out" },
                { label: "Proposal", detail: "Sent & Reviewed" },
                { label: "Agreement", detail: "Terms Signed" },
                { label: "Kickoff", detail: "Project Started" },
                { label: "Milestone 1", detail: "First Delivery" },
            ]
        },
        {
            id: 'feedback',
            title: "Feedback Loop",
            color: "#ef4444", // Red
            data: [
                { label: "Submission", detail: "Draft V1" },
                { label: "Review", detail: "Client Comments" },
                { label: "Revisions", detail: "Updates made" },
                { label: "Final Approval", detail: "Pending..." },
            ]
        }
    ];

    const activeSlide = slides[currentSlide];
    const { color, data } = activeSlide;

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

    // Generate Path and Points dynamically - UPWARD ZIG ZAG
    const { pathD, points } = useMemo(() => {
        const width = 1200; // Increased width for longer line
        const height = 400;

        const startX = 50;
        const startY = 350;
        const endX = 1150; // Use full width
        const endY = 50;

        // Linear Slope Function
        const getLinearY = (x) => {
            const slope = (endY - startY) / (endX - startX);
            return startY + slope * (x - startX);
        };

        // Zig Zag (Sine Wave) Parameters
        const amplitude = 40; // Height of zig zag
        const frequency = 0.015; // Slightly adjusted frequency for longer line

        // Combined Function: Slope + Wave
        const getY = (x) => {
            // Only apply wave between start and end
            if (x < startX || x > endX) return getLinearY(x);
            return getLinearY(x) + amplitude * Math.sin((x - startX) * frequency);
        };

        // Generate Path String with fine granularity for smoothness
        let d = `M ${startX} ${getY(startX)}`;
        for (let x = startX; x <= endX; x += 5) {
            d += ` L ${x} ${getY(x)}`;
        }

        // Calculate Points
        const pts = data.map((item, index) => {
            // Distribute points evenly along the X axis
            const step = (endX - startX) / (data.length + 1);
            const x = startX + step * (index + 1);
            const y = getY(x);

            return { x, y, ...item };
        });

        return { pathD: d, points: pts };

    }, [data]);

    return (
        <div className="growth-modal-overlay">
            <div className="growth-modal-content large-modal">
                <button className="close-btn" onClick={onClose}><X size={24} /></button>

                {/* Navigation */}
                <button className="nav-btn prev" onClick={prevSlide}><ChevronLeft size={30} /></button>
                <button className="nav-btn next" onClick={nextSlide}><ChevronRight size={30} /></button>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeSlide.id}
                        className="slide-container"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h2 className="growth-title" style={{
                            background: `linear-gradient(to right, ${color}, white)`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {activeSlide.title}
                        </h2>

                        <div className="growth-chart-container">
                            <svg className="growth-svg" viewBox="0 0 1200 400">
                                <defs>
                                    <linearGradient id={`grad-${activeSlide.id}`} x1="0" y1="1" x2="1" y2="0">
                                        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                                        <stop offset="100%" stopColor={color} stopOpacity="1" />
                                    </linearGradient>

                                    {/* Nurotra Gradient for Text */}
                                    <linearGradient id="nurotra-text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#ff00cc" />
                                        <stop offset="100%" stopColor="#333399" />
                                    </linearGradient>

                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                                        <feMerge>
                                            <feMergeNode in="coloredBlur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
                                    <filter id="strong-glow">
                                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                        <feMerge>
                                            <feMergeNode in="coloredBlur" />
                                            <feMergeNode in="coloredBlur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
                                    <filter id="text-glow">
                                        <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="black" />
                                    </filter>
                                </defs>

                                {/* Upward Path with ZigZag */}
                                <motion.path
                                    d={pathD}
                                    fill="transparent"
                                    stroke={`url(#grad-${activeSlide.id})`}
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    filter="url(#glow)"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 1.5, ease: "easeInOut" }}
                                />

                                {/* Points and Connections */}
                                {points.map((pt, i) => {
                                    const delayBase = 1.5 + (i * 0.4);

                                    // Alternating label position (Up/Down) for cleanliness or just Up for Growth effect
                                    // Reference image suggests vertical lines up. Let's go Up.
                                    const connectorHeight = 60;
                                    const labelY = pt.y - connectorHeight;

                                    return (
                                        <g key={i}>
                                            {/* Connector Line */}
                                            <motion.line
                                                x1={pt.x}
                                                y1={pt.y}
                                                x2={pt.x}
                                                y2={labelY + 25} // Stop just before text
                                                stroke={color}
                                                strokeWidth="2" // Slightly thicker connector
                                                strokeDasharray="4 2" // Dashed or solid? User said "thin glowing line"
                                                initial={{ pathLength: 0, opacity: 0 }}
                                                animate={{ pathLength: 1, opacity: 0.6 }}
                                                transition={{ delay: delayBase + 0.2, duration: 0.3 }}
                                            />

                                            {/* Main Dot - Extra GLOWING */}
                                            <motion.circle
                                                cx={pt.x}
                                                cy={pt.y}
                                                r="9" // Increased size
                                                fill="#1a1a1a" // Dark center
                                                stroke={color}
                                                strokeWidth="3"
                                                filter="url(#strong-glow)"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: delayBase, type: "spring" }}
                                            />

                                            {/* Pulsing Outer Ring */}
                                            <motion.circle
                                                cx={pt.x}
                                                cy={pt.y}
                                                r="18" // Increased size
                                                stroke={color}
                                                strokeWidth="2"
                                                fill="transparent"
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: [0, 0.6, 0], scale: 1.6 }}
                                                transition={{
                                                    delay: delayBase,
                                                    duration: 2,
                                                    repeat: Infinity,
                                                    repeatDelay: 1
                                                }}
                                            />

                                            {/* Detailed Label Group */}
                                            <motion.g
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: delayBase + 0.4 }}
                                            >
                                                {/* Text Background (Optional for legibility) */}

                                                <text
                                                    x={pt.x}
                                                    y={labelY}
                                                    fill="white"
                                                    fontSize="20" // Increased font size
                                                    fontWeight="bold"
                                                    textAnchor="middle"
                                                    filter="url(#text-glow)"
                                                >
                                                    {pt.label}
                                                </text>
                                                <text
                                                    x={pt.x}
                                                    y={labelY + 24}
                                                    fill="white" // Changed to white as requested
                                                    fontSize="18" // Further Increased
                                                    fontWeight="bold"
                                                    textAnchor="middle"
                                                    style={{ opacity: 1, letterSpacing: '0.5px' }}
                                                >
                                                    {pt.detail}
                                                </text>
                                            </motion.g>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Slider Indicators */}
                <div className="slider-dots">
                    {slides.map((_, idx) => (
                        <div
                            key={idx}
                            className={`dot ${idx === currentSlide ? 'active' : ''}`}
                            onClick={() => setCurrentSlide(idx)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
