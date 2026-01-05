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
    const KNOWLEDGE_BASE = [
        {
            path: '/dashboard',
            id: 'dashboard_guide',
            content: "Welcome to your Command Center. Here you can track your active collaborations, recent matches, and overall performance at a glance."
        },
        {
            path: '/match-results',
            id: 'match_guide',
            content: "Nuro matches are sorted by behavioral compatibility, not just skills. Look for high 'Clarity' scores to ensure smooth collaboration."
        },
        {
            path: '/profile',
            id: 'profile_guide',
            content: "This is your professional identity. Nuro tracks 'Reliability' and 'Clarity' here to help you improve your reputation over time."
        },
        {
            path: '/matching-standards',
            id: 'standards_guide',
            content: "Define your non-negotiables here. I use these standards to filter out bad matches before you even see them."
        },
        {
            path: '/overview',
            id: 'overview_guide',
            content: "A high-level view of your entire network and activity. Use this to spot trends in your interaction volume and success rates."
        },
        {
            path: '/collab-insights',
            id: 'insights_guide',
            content: "This is where I analyze your deal-making patterns. I'll highlight what's working and where you might be leaving money on the table."
        },
        {
            path: '/history',
            id: 'history_guide',
            content: "Your digital paper trail. Review past collaborations to understand why some partnerships succeeded while others stalled."
        },
        {
            path: '/safety',
            id: 'safety_guide',
            content: "Your safety is paramount. I monitor every interaction for potential risks, scams, or toxicity. Check your trust score here."
        },
        {
            path: '/collab',
            id: 'collab_guide',
            content: "I am now monitoring your negotiation. Keep your tone direct and your asks specific to maintain a high 'active' score."
        },
        {
            path: '/chat',
            id: 'chat_guide',
            content: "This is your direct line to your AI Assistant. Ask me anything about your performance, market trends, or specific deal advice."
        },
        {
            path: '/nuro-lab',
            id: 'lab_guide',
            content: "Welcome to Nuro Lab. This is my experimental core where you can see raw metrics and behavioral analysis I've gathered on you."
        }
    ];

    // 1) NURO’S CORE AGENTIC BEHAVIOR (Always-On)
    // Mode Switching Logic based on Context (Location/Actions)
    useEffect(() => {
        const path = location.pathname;

        // Determine Mode
        if (path.includes('/dashboard')) {
            switchMode('learning');
        } else if (path.includes('/collab') || path.includes('/match')) {
            switchMode('guiding');
        } else if (path.includes('/profile')) {
            switchMode('advising');
        } else {
            switchMode('observing');
        }

        // Trigger Contextual Guidance
        checkGuidance(path);

    }, [location]);

    const checkGuidance = (currentPath) => {
        // Find a guide that matches the current path (checking for partial matches for role-based routes)
        const guide = KNOWLEDGE_BASE.find(g => currentPath.includes(g.path));

        if (guide) {
            // Check localStorage to ensure this guide is shown ONLY ONCE per user forever
            const storageKey = `nuro_seen_${guide.id}`;
            const hasSeen = localStorage.getItem(storageKey);

            if (!hasSeen) {
                // Short delay to let the page load visually before interrupting
                setTimeout(() => {
                    setActiveInterrupt({
                        type: 'fact', // Uses 'fact' style for mentorship
                        title: 'Nuro Guidance 🧭',
                        content: guide.content,
                    });
                    localStorage.setItem(storageKey, 'true');
                }, 1000);
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
        console.log(`[NURO MEMORY] Feedback collected: ${response}`);
        // TODO: Send to backend
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
