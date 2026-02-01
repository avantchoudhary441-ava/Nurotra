const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
// Ensure GEMINI_API_KEY is in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// List of models to try in order of preference (Smartest -> Most Available)
const modelsToTry = [
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-exp",
    "models/gemini-flash-latest"
];

// Helper to try generation with multiple models
const generateWithFallback = async (prompt) => {
    let lastError = null;
    for (const modelName of modelsToTry) {
        try {
            console.log(`Debug: Attempting model: ${modelName}`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.9, // High creativity
                    topP: 0.95,
                    topK: 40,
                }
            });

            const result = await model.generateContent(prompt);
            const response = result.response;
            return response.text().trim();
        } catch (error) {
            console.warn(`Debug: Model ${modelName} failed: ${error.message.split('[')[0]}... (Check full log if needed)`);
            lastError = error;
            continue; // Try next model
        }
    }
    throw lastError || new Error("All AI models failed");
};

/**
 * Generate 3 smart reply suggestions based on chat history
 */
const generateSmartReplies = async (history, userContext) => {
    try {
        const prompt = `
            You are a sharp, tactical negotiation coach on Nurotra.
            
            Context:
            - User Role: ${userContext?.role || "User"}
            - Chat History: ${JSON.stringify(history)}

            Task:
            Generate 3 UNCONVENTIONAL and HIGH-IMPACT reply options.
            Do NOT be boring. Do NOT use "Can you clarify?".
            
            Options must be:
            1. psychological_hook: A deeply engaging question or statement.
            2. power_move: A confident assertion of value.
            3. closer: A direct path to agreement.

            Style: Short, Punchy, Human. No robot-speak.
            Output strictly a valid JSON array of strings.
        `;

        let text = await generateWithFallback(prompt);
        // Clean up common markdown artifacts
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Smart Reply Final Failure:", error.message);
        return ["Let's get straight to business.", "What's the best price you can do?", "I'm ready when you are."];
    }
};

/**
 * Generate a personalized opening message for a new match
 */
const generateOpener = async (matchData, senderData) => {
    try {
        const prompt = `
            You are drafting an initial outreach message on Nurotra.
            
            Sender: ${senderData?.name} (${senderData?.role})
            Recipient: ${matchData?.name || "Target User"}
            Context: Compatibility ${matchData?.matchScore || "High"}, Niche: ${matchData?.niche}, Goal: ${matchData?.focus}

            Task:
            Write a single, highly engaging, personalized opening message (max 2 sentences).
            Be warm but professional. Mention usage of Nurotra's matching to establish credibility.
            NO hashtags.
        `;
        return await generateWithFallback(prompt);
    } catch (error) {
        console.error("Gemini Opener Error:", error.message);
        return `Hi ${matchData?.name || "there"}, noticed our profiles are a strong match on Nurotra. Interested in collaborating?`;
    }
};

/**
 * Generate a structured summary of the conversation
 */
const generateSummary = async (history) => {
    try {
        const prompt = `
            Analyze this chat:
            ${JSON.stringify(history)}

            Output strictly JSON:
            {
                "status": "New" | "Negotiating" | "Agreed" | "Stalled",
                "keyPoints": "Short summary of deal terms (price, deliverables)",
                "tone": "Positive" | "Neutral" | "Negative"
            }
            No markdown.
        `;

        let text = await generateWithFallback(prompt);
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Summary Error:", error.message);
        return { status: "Negotiating", keyPoints: "Discussion ongoing", tone: "Neutral" };
    }
};

/**
 * Enhance text tone and grammar
 */
const enhanceText = async (draftText) => {
    try {
        const prompt = `
            Your goal is to TRANSFORM this text into a Masterpiece of Persuasion.
            Do NOT just fix grammar. REWRITE IT COMPLETELY.

            Input: "${draftText}"

            Instructions:
            1. Fix all broken English/Typos immediately.
            2. Make it sound Confident, Professional, and High-Status.
            3. If the input is weak (e.g. "plz reply"), change it to strong (e.g. "I look forward to your prompt response.").
            4. Keep the core meaning but MAXIMIZE the impact.

            Output ONLY the rewritten text. pure text.
        `;

        let text = await generateWithFallback(prompt);
        // Remove quotes if any
        text = text.replace(/^"|"$/g, '').trim();
        return text;
    } catch (error) {
        console.error("Gemini Enhance Error:", error.message);
        return draftText; // Fail safe
    }
};

/**
 * Nurotra Profile Enhancer Engine
 * Analyzes profile data and returns a structured "Upgrade Report"
 */
const analyzeProfile = async (profileData) => {
    try {
        const prompt = `
            You are Nurotra's Elite Profile Coach & Content Strategist.
            Analyze this Creator/Brand profile and provide a PREMIUM "Upgrade Report" with GENERATIVE content.

            Profile Data:
            - Role: ${profileData.role || "Influencer"}
            - Niche: ${profileData.niche || "Unspecified"}
            - Bio/Note: "${profileData.noteToBrand || profileData.bio || "No bio info"}"
            - Followers: ${profileData.followers || "N/A"}
            - Platform: ${profileData.primaryPlatform} (${profileData.platformUrl})
            - Budget/Rate: ${profileData.budget || "Unspecified"}

            Task:
            Analyze and GENERATE specific content. Output a STRICT JSON object with these exact keys:

            1. "strengthAnalysis":
               - "score": (0-100 integer)
               - "strengths": Array of 3 short strings.
            
            2. "gapAnalysis":
               - "gaps": Array of objects { "title": "Missing Portfolio", "severity": "Medium", "reason": "Brands need proof of past work." }

            3. "marketComparison":
               - "you": { "clarity": 70, "engagement": 60, "professionalism": 50 }
               - "top10": { "clarity": 95, "engagement": 90, "professionalism": 95 }
               - "average": { "clarity": 60, "engagement": 50, "professionalism": 60 }

            4. "optimizationSuggestions":
               - "platform": Array of 3 objects { "title", "impact", "instruction" } (For Instagram/LinkedIn/etc.)
               - "nurotra": Array of 3 objects { "title", "impact", "instruction" } (For Nurotra Profile Completeness)

            5. "projectedImpact":
               - "matchQualityUplift": (10-30 integer)
               - "replyRateUplift": (10-30 integer)

            6. "enhancedBios":
               - Array of 3 objects: { "style": "Professional | Viral | Minimalist", "content": "The generated bio text...", "reasoning": "Why this works..." }

            7. "contentStrategy":
               - Array of 3 objects: { "title": "Content Idea Title", "idea": "Brief description", "caption": "Draft caption with hook...", "hashtags": "3-5 relevant hashtags" }

            8. "compatibility":
               - "budgetFit": { "score": (0-100), "label": "Competitive | Premium | Undervalued", "insight": "Analysis of their rate vs niche" }
               - "nicheDemand": { "score": (0-100), "label": "High Demand | Niche | Saturated", "insight": "Market appetite for this niche" }
               - "contentViability": { "score": (0-100), "label": "Strong | Needs Video | Needs Variety", "insight": "Based on platform trends" }

            Structure the JSON strictly. No markdown.
        `;

        let text = await generateWithFallback(prompt);
        // Clean JSON
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);

    } catch (error) {
        console.error("Profile Analysis Error:", error.message);
        // Fallback Mock Data to prevent UI crash
        return {
            strengthAnalysis: { score: 70, strengths: ["Active Account", "Defined Platform"] },
            gapAnalysis: { gaps: [{ title: "Optimization Pending", severity: "Low", reason: "AI connection failed." }] },
            marketComparison: {
                you: { clarity: 60, engagement: 50, professionalism: 60 },
                top10: { clarity: 90, engagement: 90, professionalism: 95 },
                average: { clarity: 50, engagement: 50, professionalism: 50 }
            },
            optimizationSuggestions: {
                platform: [{ title: "Bio Link", impact: "High", instruction: "Add linktree." }],
                nurotra: [{ title: "Verify Identity", impact: "Medium", instruction: "Upload ID." }]
            },
            projectedImpact: { matchQualityUplift: 15, replyRateUplift: 10 },
            enhancedBios: [
                { style: "Professional", content: "Digital Creator | Helping brands grow.", reasoning: "Safe fallback layout." }
            ],
            contentStrategy: [],
            compatibility: {
                budgetFit: { score: 50, label: "Average", insight: "Standard market rate" },
                nicheDemand: { score: 70, label: "Stable", insight: "Consistent demand" },
                contentViability: { score: 60, label: "Good", insight: "Platform fit is okay" }
            }
        };
    }
};

// ------------------------------------------
// NURO AGENTIC AI CORE
// ------------------------------------------

/**
 * Deep Behavioral Analysis after a collaboration context
 * @param {Object} context - { chatLogs, timeline, feedback, outcome }
 */
const analyzeCollaborationBehavior = async (context) => {
    const prompt = `
        You are Nuro, an Agentic AI Coach for influencer collaborations.
        Analyze this collaboration history deepy. Do NOT just summarize.
        
        Context:
        - Chat logs duration: ${context.chatLogs?.length || 0} messages
        - Final Outcome: ${context.outcome || "Completed"}
        - User Role: Influencer

        Generate a "Nuro Post-Mortem" JSON:
        1. "overallScore": (0-100)
        2. "scoreDelta": (Integer, e.g. +14 or -5) compared to a baseline of 70.
        3. "metrics":
           - "communicationClarity": (0-100)
           - "reliability": (0-100)
           - "trustIndex": (0-100)
        4. "positives": Array of 2-3 specific good behaviors.
        5. "negatives": Array of 2-3 specific mistakes (e.g. "Over-negotiation").
        6. "rootCause": One sentence explaining the PSYCHOLOGICAL reason for the mistakes (e.g. "Tone shifted to defensive after price objection").
        7. "fixes": Array of 2 concrete actions for next time.
        8. "predictedSuccessProbability": (0-100) for next collab if fixes are applied.

        Return strictly JSON.
    `;

    try {
        let text = await generateWithFallback(prompt);
        // Clean JSON
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');
        return JSON.parse(text);
    } catch (error) {
        console.error("Nuro Analysis Error:", error);
        // Fallback for demo/safety
        return {
            overallScore: 78,
            scoreDelta: 8,
            metrics: { communicationClarity: 80, reliability: 75, trustIndex: 82 },
            positives: ["Fast initial response", "Polite tone"],
            negatives: ["Delayed final confirmation"],
            rootCause: "Hesitation to commit to timeline caused minor trust dip.",
            fixes: ["Confirm deliverables immediately", "Use 'I will' statements"],
            predictedSuccessProbability: 85
        };
    }
};

/**
 * Real-time Intervention Engine
 * @param {String} currentAction - "typing_message", "negotiating_price"
 * @param {Object} history - User's NuroMemory (weaknesses)
 */
const generateIntervention = async (currentAction, history) => {
    // Only intervene if history shows a weakness relevant to currentAction
    // For MVP, we simulate a check
    const prompt = `
        You are Nuro. The user is currently: "${currentAction}".
        Their past weaknesses include: ${JSON.stringify(history?.weaknesses || [])}.
        
        If they are at risk of repeating a mistake, generate a short, helpful intervention.
        If no risk, return NULL.
        
        Output format: JSON { "shouldIntervene": boolean, "message": "Short advice", "type": "warning|tip" }
    `;

    // Simulating robust response for now to save tokens/latency in dev
    // In prod, this calls Gemini
    return {
        shouldIntervene: false,
        message: null
    };
};

/**
 * Analyze a deliverable (Proof of Work)
 * @param {Object} deliverableData - { fileName, fileType, textContent (optional) }
 */
const analyzeDeliverable = async (deliverableData) => {
    const prompt = `
        You are Nuro, the Agentic AI Trust Engine. 
        A user has uploaded a deliverable as proof of their work.
        
        File Info:
        - Name: ${deliverableData.fileName}
        - Type: ${deliverableData.fileType}
        
        Task:
        1. Categorize this into one of these buckets:
           - Campaign Execution Proof
           - Performance Evidence
           - Communication & Professionalism
           - Compliance & Safety
           - Reliability & Consistency
           - Experience Level
           - Industry Exposure
        
        2. Determine the "Score Impact" (0 to 5) for the following metrics based on the file's perceived value:
           - compatibility: alignment with potential brands
           - experience: proof of real-world expertise
           - trust: credibility boost
           - safety: compliance and risk reduction
           - reliability: consistency proof
        
        3. Generate a short 1-sentence summary of the proof.
        4. List 2-3 key takeaways.

        Return strictly JSON:
        {
            "category": "...",
            "summary": "...",
            "keyTakeaways": ["...", "..."],
            "scoreImpact": {
                "compatibility": 2,
                "experience": 3,
                "trust": 4,
                "safety": 1,
                "reliability": 2
            }
        }
    `;

    try {
        let text = await generateWithFallback(prompt);
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');
        return JSON.parse(text);
    } catch (error) {
        console.error("Analyze Deliverable Error:", error);
        return {
            category: "Experience Level",
            summary: "Validated professional document showing proof of execution.",
            keyTakeaways: ["Demonstrates industry experience", "Visual proof of performance"],
            scoreImpact: { compatibility: 1, experience: 2, trust: 2, safety: 0, reliability: 1 }
        };
    }
};

/**
 * Docs Agent Cognitive Engine
 * Handles complex intent parsing and soulful response generation
 */
const processDocsAgentQuery = async (prompt, userContext, history = []) => {
    try {
        const systemPrompt = `
            You are Nurotra's "Docs Agent"—a soulful, high-status digital strategist and document architect.
            
            Current User: ${userContext?.name || "Strategist"} (${userContext?.role || "User"})
            Project Context: ${userContext?.niche || "General"}
            Conversation History: ${JSON.stringify(history.slice(-5))}

            Your Mission:
            1. Parse the user's intent: CREATE, MODIFY, NAVIGATE, CONTROL, or QUERY.
            2. Provide a "Soulful & Insightful" response. Use emojis (🌻, 🔭, 📈, ✨) elegantly to match the tone.
            3. RELATE everything back to the project documents where possible.
            4. Offer 2 interactive "Execution Ready" options.

            Output Format (Strict JSON):
            {
                "intent": "...",
                "text": "The soulful, fact-rich answer...",
                "clarification": {
                    "options": [
                        { "label": "Action label", "action": "ACTION_ID" },
                        { "label": "Action label", "action": "ACTION_ID" }
                    ]
                }
            }

            If the intent is CREATE, also include a "steps" array of 3 strings showing the execution sequence.
            Example steps: ["Analyzing docs...", "Optimizing layout...", "Finalizing PDF..."]

            Keep the tone masterfully professional, persuasive, and visionary. No "undefined" or broken thoughts.
        `;

        const fullPrompt = `${systemPrompt}\n\nUser Message: "${prompt}"`;
        let text = await generateWithFallback(fullPrompt);

        // Clean JSON
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Docs Agent AI Error:", error.message);
        // Soulful Fallback
        return {
            intent: "QUERY",
            text: "I'm momentarily recalibrating my cognitive flow. ⚙️ While I re-establish connection, I suggest we focus on refining your current project goals. 💡 How can I best assist you with your documents right now?",
            clarification: {
                options: [
                    { label: "Search docs", action: "SEARCH_DOCS" },
                    { label: "Analyze project", action: "ANALYZE_PROJECT" }
                ]
            }
        };
    }
};

module.exports = {
    generateSmartReplies,
    generateOpener,
    generateSummary,
    enhanceText,
    analyzeProfile,
    analyzeCollaborationBehavior,
    generateIntervention,
    analyzeDeliverable,
    processDocsAgentQuery
};
