import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const NuroContext = createContext();

export const useNuro = () => useContext(NuroContext);

export const NuroProvider = ({ children }) => {
    const [mode, setMode] = useState("active"); // active, learning, advising
    const [interrupt, setInterrupt] = useState(null); // { type, title, message, actions }
    const [orbState, setOrbState] = useState("idle"); // idle, thinking, alert
    const [insightMessage, setInsightMessage] = useState("I'm monitoring your collaboration flow.");
    const [showDashboard, setShowDashboard] = useState(false);

    // Memory Data
    const [memory, setMemory] = useState(null);

    const toggleDashboard = () => setShowDashboard(!showDashboard);

    // Initial Fetch of User's Nuro Memory
    useEffect(() => {
        // In real app: fetch from /api/nuro/memory
        // For now, mock or empty
    }, []);

    // Function to trigger an intervention
    const triggerIntervention = (msg, type = "warning") => {
        setInsightMessage(msg);
        setOrbState(type === "warning" ? "alert" : "thinking");
        setTimeout(() => setOrbState("idle"), 5000);
    };

    // SYSTEM 2: INTERRUPT OVERLAY
    const triggerInterrupt = (type, title, message, actions = null, duration = 5000) => {
        setInterrupt({ type, title, message, actions, duration });
    };

    const clearInterrupt = () => setInterrupt(null);

    return (
        <NuroContext.Provider value={{
            mode, setMode,
            orbState, setOrbState,
            insightMessage, setInsightMessage,
            showDashboard, setShowDashboard, toggleDashboard,
            triggerIntervention,
            memory,
            // Interrupt System
            interrupt, triggerInterrupt, clearInterrupt
        }}>
            {children}
        </NuroContext.Provider>
    );
};
