import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const NuroContext = createContext();

export const useNuro = () => useContext(NuroContext);

export const NuroProvider = ({ children }) => {
    const [mode, setMode] = useState("active"); // active, learning, advising
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

        // Auto-dismiss alert state after 5s
        setTimeout(() => setOrbState("idle"), 5000);
    };

    return (
        <NuroContext.Provider value={{
            mode, setMode,
            orbState, setOrbState,
            insightMessage, setInsightMessage,
            showDashboard, setShowDashboard, toggleDashboard,
            triggerIntervention,
            memory
        }}>
            {children}
        </NuroContext.Provider>
    );
};
