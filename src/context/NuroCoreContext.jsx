import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const NuroCoreContext = createContext();

export const useNuroCore = () => useContext(NuroCoreContext);

export const NuroCoreProvider = ({ children }) => {
    // 3️⃣ NURO MODES (BEHAVIORAL STATES)
    const [mode, setMode] = useState('observing'); // observing, learning, advising, intervening, guiding, appreciating, warning
    const [activeInterrupt, setActiveInterrupt] = useState(null); // { type: 'question', content: '...' }
    const location = useLocation();

    // 1) NURO’S CORE AGENTIC BEHAVIOR (Always-On)
    // Mode Switching Logic based on Context (Location/Actions)
    // 🧠 GUIDANCE KNOWLEDGE BASE (Contextual Mentorship)
    const KNOWLEDGE_BASE = {
        '/match-results': {
            id: 'match_guide',
            content: "Nuro matches are sorted by behavioral compatibility, not just skills. Look for high 'Clarity' scores to ensure smooth collaboration."
        },
        '/profile': {
            id: 'profile_guide',
            content: "This is your professional identity. Nuro tracks 'Reliability' and 'Clarity' here to help you improve your reputation over time."
        },
        '/collab': {
            id: 'collab_guide',
            content: "I am now monitoring your negotiation. Keep your tone direct and your asks specific to maintain a high 'active' score."
        }
    };

    // 1) NURO’S CORE AGENTIC BEHAVIOR (Always-On)
    // Mode Switching Logic based on Context (Location/Actions)
    useEffect(() => {
        const path = location.pathname;

        // Determine Mode
        if (path.includes('/dashboard')) {
            switchMode('learning');
        } else if (path.includes('/collab') || path.includes('/match')) {
            switchMode('guiding');
        } else if (path === '/profile') {
            switchMode('advising');
        } else {
            switchMode('observing');
        }

        // Trigger Contextual Guidance
        checkGuidance(path);

    }, [location]);

    const checkGuidance = (path) => {
        const guide = KNOWLEDGE_BASE[path];
        // In a real app, we'd check if `hasSeenGuide(guide.id)` is false
        // For demo, we'll trigger it occasionally or if explicitly entering major features
        if (guide) {
            // 50% chance to show guide to avoid spamming during dev, or use session storage
            const sessionKey = `seen_${guide.id}`;
            if (!sessionStorage.getItem(sessionKey)) {
                setActiveInterrupt({
                    type: 'fact', // Uses 'fact' style for mentorship
                    title: 'Contextual Guide 🧭',
                    content: guide.content,
                });
                sessionStorage.setItem(sessionKey, 'true');
            }
        }
    };

    const switchMode = (newMode) => {
        if (mode !== newMode) {
            setMode(newMode);
        }
    };

    // 🔁 FEEDBACK INTELLIGENCE & MICRO-QUESTIONS
    const triggerEngagement = () => {
        const types = ['fact', 'question'];
        const selected = types[Math.floor(Math.random() * types.length)];

        if (selected === 'question') {
            // One-word questions / Quick feedback
            setActiveInterrupt({
                type: 'question',
                title: 'Quick Check 🧠',
                content: 'Was the last collaboration effective?',
                options: ['Yes', 'No', 'Meh']
            });
        } else {
            // Sharing insights / Facts
            setActiveInterrupt({
                type: 'fact',
                title: 'Did you know? 💡',
                content: 'Your clarity score has improved by 15% this week. Keep it simple!',
                duration: 5000 // Auto dismiss facts
            });
        }
    };

    const triggerIntervention = (reason) => {
        switchMode('intervening'); // ✋
        setActiveInterrupt({
            type: 'warning',
            title: 'Intervention ✋',
            content: reason || "I detected a potential risk in this action. Are you sure?",
            options: ['Proceed', 'Review']
        });
    };

    const dismissInterrupt = () => {
        setActiveInterrupt(null);
        // Return to context-appropriate mode
        if (location.pathname.includes('/profile')) switchMode('advising');
        else switchMode('observing');
    };

    const handleFeedback = (response) => {
        // Feedback collected: response
        dismissInterrupt();
    };

    return (
        <NuroCoreContext.Provider value={{
            mode,
            activeInterrupt,
            switchMode,
            triggerIntervention,
            dismissInterrupt,
            handleFeedback
        }}>
            {children}
        </NuroCoreContext.Provider>
    );
};
