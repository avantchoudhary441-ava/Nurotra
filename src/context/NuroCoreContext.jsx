import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { nuroService } from '../services/apiService';

const NuroCoreContext = createContext();

export const useNuroCore = () => useContext(NuroCoreContext);

export const NuroCoreProvider = ({ children }) => {
    // 3️⃣ NURO MODES (BEHAVIORAL STATES)
    const [mode, setMode] = useState('observing'); // observing, learning, advising, intervening, guiding, appreciating, warning
    const [activeInterrupt, setActiveInterrupt] = useState(null); // { type: 'question', content: '...' }
    const [memory, setMemory] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    // 🧠 INITIAL FETCH: Sync Nuro Memory from Cloud
    useEffect(() => {
        const fetchMemory = async () => {
            try {
                const data = await nuroService.getMemory();
                setMemory(data);
            } catch (err) {
                console.warn("Nuro Memory sync failed, using offline fallback.", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMemory();
    }, []);

    // 1) NURO’S CORE AGENTIC BEHAVIOR (Always-On)
    // Mode Switching Logic based on Context (Location/Actions)
    // 🧠 GUIDANCE KNOWLEDGE BASE (Contextual Mentorship)
    const NURO_QUOTES = [
        "The best way to predict the future is to create it. 🌟",
        "Your only limit is your soul. ✨",
        "Clarity is power. Let's keep it simple. 🧠",
        "Great things never come from comfort zones. 🚀",
        "Success is a series of small wins. You're doing great! ✅",
        "Focus on progress, not perfection. 📈",
        "Your professional identity is your greatest asset. 💎"
    ];

    const getRandomQuote = () => NURO_QUOTES[Math.floor(Math.random() * NURO_QUOTES.length)];

    const KNOWLEDGE_BASE = [
        {
            path: '/dashboard',
            id: 'dashboard_guide',
            content: "Welcome to your Command Center! I've set this up so you can easily track your collaborations and see how you're performing at a glance. We're in this together."
        },
        {
            path: '/match-results',
            id: 'match_guide',
            content: "I've sorted these matches by how well your behaviors align, not just skills. Look for high 'Clarity' scores—they usually mean a much smoother partnership!"
        },
        {
            path: '/profile',
            id: 'profile_guide',
            content: "This is your professional home. I'll be tracking things like 'Reliability' and 'Clarity' here to help you build a reputation that opens doors."
        },
        {
            path: '/matching-standards',
            id: 'standards_guide',
            content: "Let's define what matters most to you. I'll use these standards to protect your time and filter out any matches that don't fit your vibe."
        },
        {
            path: '/overview',
            id: 'overview_guide',
            content: "Think of this as your high-level map. It's a great place to spot trends in how you're growing and where your network is strongest."
        },
        {
            path: '/collab-insights',
            id: 'insights_guide',
            content: "I'm analyzing your deal patterns here. My goal is to show you exactly what's working so you can stop leaving money on the table."
        },
        {
            path: '/history',
            id: 'history_guide',
            content: "Your digital paper trail! We can look back at past wins and learning moments here to figure out why some deals succeeded while others stalled."
        },
        {
            path: '/safety',
            id: 'safety_guide',
            content: "Your safety is my top priority. I'm constantly monitoring for risks or toxicity so you can focus on building trust with the right people."
        },
        {
            path: '/collab',
            id: 'collab_guide',
            content: "I'm right here with you during this negotiation. Keep your tone clear and your asks specific to keep the momentum going!"
        },
        {
            path: '/chat',
            id: 'chat_guide',
            content: "I'm your dedicated AI Assistant. Feel free to ask me anything about your performance, market trends, or for specific advice on a deal."
        },
        {
            path: '/nuro-lab',
            id: 'lab_guide',
            content: "Welcome to my experimental core! This is where you can see the raw data and behavioral patterns I'm learning from our time together."
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
        } else if (path === '/profile') {
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
            // Check cloud memory instead of localStorage
            const hasSeen = memory?.seenGuides?.includes(guide.id);

            if (!hasSeen && !loading) {
                // Short delay to let the page load visually before interrupting
                setTimeout(() => {
                    setActiveInterrupt({
                        type: 'fact', // Uses 'fact' style for mentorship
                        id: guide.id, // Keep track of ID
                        title: 'Nuro Guidance 🧭',
                        content: `${guide.content}\n\n*"${getRandomQuote()}"*`,
                    });

                    // Optimistic update + Backend sync
                    nuroService.markGuideSeen(guide.id);
                    setMemory(prev => ({
                        ...prev,
                        seenGuides: [...(prev?.seenGuides || []), guide.id]
                    }));
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
                content: `Quick thought: Was your last collaboration actually effective?\n\n*"${getRandomQuote()}"*`,
                options: ['Yes', 'No', 'Neutral']
            });
        } else {
            // Sharing insights / Facts
            setActiveInterrupt({
                type: 'fact',
                title: 'Growth Insight 💡',
                content: `Great work! Your clarity score improved by 15% this week. Keeping things simple is definitely paying off.\n\n*"${getRandomQuote()}"*`,
                duration: 6000
            });
        }
    };

    const triggerIntervention = (reason, context = "Manual") => {
        switchMode('intervening'); // ✋
        setActiveInterrupt({
            type: 'warning',
            title: 'Intervention ✋',
            content: `${reason || "I detected a potential risk in this action. Are you sure?"}\n\n*"${getRandomQuote()}"*`,
            options: ['Proceed', 'Review']
        });

        // Log intervention to backend
        nuroService.saveFeedback(`Intervention triggered: ${reason}`, context);
    };

    // ⚡ REAL-TIME INTERVENTION LOGIC (Calibrator)
    const checkSafety = (content, context) => {
        // Calibrate: Check for "Negotiation Anxiety" patterns from memory
        const weaknesses = memory?.behavioralPatterns?.filter(p => p.confidence > 70) || [];

        if (content.length > 5 && context === 'Chat') {
            const hasNegotiationWeakness = weaknesses.some(w => w.trait === 'Negotiation Anxiety');
            const isPricingMentioned = content.toLowerCase().includes('₹') || content.toLowerCase().includes('rs');

            if (hasNegotiationWeakness && isPricingMentioned) {
                triggerIntervention("I've noticed your tone often shifts during price discussions. Stay confident—you've got this!", "Chat");
            }
        }
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

        // PERSIST TO CLOUD
        nuroService.saveFeedback(response, activeInterrupt?.title || "Passive Engagement");

        dismissInterrupt();
    };

    return (
        <NuroCoreContext.Provider value={{
            mode,
            activeInterrupt,
            memory,
            loading,
            switchMode,
            triggerIntervention,
            dismissInterrupt,
            handleFeedback,
            checkSafety
        }}>
            {children}
        </NuroCoreContext.Provider>
    );
};
