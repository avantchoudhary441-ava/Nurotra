import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import logo from "../assets/NurotraLogo.png"; // Using Logo as the "Leaf"

export default function LeafTransition({ onComplete, isActive }) {
    if (!isActive) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 9999,
                pointerEvents: "none", // Let clicks pass through initially if needed, but here we want to block interaction
                overflow: "hidden",
            }}
        >
            {/* The Leaf/Logo Animation */}
            <motion.img
                src={logo}
                alt="Leaf Transition"
                initial={{ x: 20, y: -50, opacity: 1, scale: 0.5, rotate: 0 }}
                animate={{
                    x: [20, 50, 20, 50, "90vw"], // Zig-zag then swoop right
                    y: [-50, 150, 300, 450, "50vh"], // Fall down then center vertically
                    rotate: [0, 45, -45, 90, 720], // Spin
                    scale: [0.5, 0.5, 0.5, 0.5, 30], // Stay small then ZOOM huge
                }}
                transition={{
                    duration: 3, // Total time: 3 seconds
                    times: [0, 0.2, 0.4, 0.6, 1], // Timing of keyframes
                    ease: "easeInOut",
                }}
                onAnimationComplete={() => {
                    // Trigger the white screen effect or navigation
                }}
                style={{
                    width: "100px",
                    height: "100px",
                    position: "absolute",
                }}
            />

            {/* The White Flash Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1] }} // Fade in at the very end
                transition={{ delay: 2.5, duration: 0.5 }}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#fff",
                }}
                onAnimationComplete={onComplete} // Navigate when screen is white
            />
        </div>
    );
}
