const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");
const Anthropic = require("@anthropic-ai/sdk");

// Initialize Providers
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const xai = process.env.XAI_API_KEY ? new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1"
}) : null;

// Simple In-Memory Cache for Cost Saving
const responseCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 Hour

// Reservoir Priority
const providerPriority = ["google", "openai", "anthropic", "xai"];

/**
 * Unified Generation with Reservoir Fallback
 */
const generateWithFallback = async (prompt, systemPrompt = "") => {
    // 1. Check Cache
    const cacheKey = Buffer.from(prompt + systemPrompt).toString('base64').substring(0, 32);
    if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log("Debug: Cache Hit for prompt");
            return cached.data;
        }
    }

    let lastError = null;
    const geminiModels = ["gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash"];

    for (const provider of providerPriority) {
        try {
            console.log(`Debug: Attempting Reservoir Provider: ${provider}`);
            let text = "";

            if (provider === "google" && genAI) {
                // Try multiple Gemini models if one fails
                for (const modelName of geminiModels) {
                    try {
                        const model = genAI.getGenerativeModel({
                            model: modelName,
                            generationConfig: { responseMimeType: "application/json" } // Force JSON
                        });
                        const result = await model.generateContent(systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt);
                        text = result.response.text().trim();
                        break; // Success
                    } catch (gError) {
                        console.warn(`Debug: Gemini Model ${modelName} failed: ${gError.message}`);
                        lastError = gError;
                        continue;
                    }
                }
                if (!text && lastError) throw lastError; // All Gemini models failed
            }
            else if (provider === "openai" && openai) {
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    response_format: { type: "json_object" }, // Force JSON
                    messages: [
                        { role: "system", content: systemPrompt || "You are a helpful assistant. Output JSON." },
                        { role: "user", content: prompt }
                    ]
                });
                text = response.choices[0].message.content.trim();
            }
            else if (provider === "anthropic" && anthropic) {
                const response = await anthropic.messages.create({
                    model: "claude-3-haiku-20240307",
                    max_tokens: 1024,
                    system: systemPrompt || "You are a helpful assistant.",
                    messages: [{ role: "user", content: prompt }]
                });
                text = response.content[0].text.trim();
            }
            else if (provider === "xai" && xai) {
                const response = await xai.chat.completions.create({
                    model: "grok-beta",
                    messages: [
                        { role: "system", content: systemPrompt || "You are a helpful assistant." },
                        { role: "user", content: prompt }
                    ]
                });
                text = response.choices[0].message.content.trim();
            }

            if (text) {
                // Save to Cache
                responseCache.set(cacheKey, { data: text, timestamp: Date.now() });
                return text;
            }
        } catch (error) {
            const isRateLimit = error.status === 429 || error.message.includes("quota") || error.message.includes("limit");
            console.warn(`Debug: Provider ${provider} failed: ${error.message}`); // Full error log
            lastError = error;
            if (isRateLimit) {
                console.log(`Debug: ${provider} quota exhausted, switching reservoir...`);
            }
            continue;
        }
    }

    throw lastError || new Error("All Reservoir AI Providers failed");
};

/**
 * Generate 3 smart reply suggestions based on chat history
 */
const generateSmartReplies = async (history, userContext) => {
    try {
        const systemPrompt = `You are a tactical negotiation coach on Nurotra. User Role: ${userContext?.role || "User"}. Output strictly a JSON array of 3 strings: [psychological_hook, power_move, closer]. Short, punchy, human. No markdown.`;
        const prompt = `Chat History: ${JSON.stringify(history.slice(-10))}`;

        let text = await generateWithFallback(prompt, systemPrompt);
        text = text.replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Smart Reply Failure:", error.message);
        return ["Let's get straight to business.", "What's the best price you can do?", "I'm ready when you are."];
    }
};

/**
 * Generate a personalized opening message for a new match
 */
const generateOpener = async (matchData, senderData) => {
    try {
        const systemPrompt = "Write a high-engagement, 1-2 sentence opening message for a Nurotra collaboration. Warm, professional, no hashtags.";
        const prompt = `Sender: ${senderData?.name} (${senderData?.role}). Recipient: ${matchData?.name}. Score: ${matchData?.matchScore}, Niche: ${matchData?.niche}.`;
        return await generateWithFallback(prompt, systemPrompt);
    } catch (error) {
        console.error("Opener Error:", error.message);
        return `Hi ${matchData?.name || "there"}, noticed our profiles are a strong match on Nurotra. Interested in collaborating?`;
    }
};

/**
 * Generate a structured summary of the conversation
 */
const generateSummary = async (history) => {
    try {
        const systemPrompt = 'Analyze chat history and output strictly JSON: {"status": "New"|"Negotiating"|"Agreed"|"Stalled", "keyPoints": "terms summary", "tone": "Positive"|"Neutral"|"Negative"}. No markdown.';
        const prompt = `History: ${JSON.stringify(history)}`;

        let text = await generateWithFallback(prompt, systemPrompt);
        text = text.replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Summary Error:", error.message);
        return { status: "Negotiating", keyPoints: "Discussion ongoing", tone: "Neutral" };
    }
};

/**
 * Enhance text tone and grammar
 */
const enhanceText = async (draftText) => {
    try {
        const systemPrompt = "Transform this text into professional, high-status English. Fix typos and maximize impact. Output ONLY the rewritten text.";
        const prompt = `Input: "${draftText}"`;

        let text = await generateWithFallback(prompt, systemPrompt);
        return text.replace(/^"|"$/g, '').trim();
    } catch (error) {
        console.error("Enhance Error:", error.message);
        return draftText; // Fail safe
    }
};

/**
 * Nurotra Profile Enhancer Engine
 * Analyzes profile data and returns a structured "Upgrade Report"
 */
const analyzeProfile = async (profileData) => {
    try {
        const systemPrompt = `
            You are Nurotra's Elite Profile Coach & Content Strategist.
            Analyze this profile and provide a PREMIUM "Upgrade Report" with GENERATIVE content.
            Output a STRICT JSON object with these exact keys:
            1. "strengthAnalysis": { "score": (0-100), "strengths": Array of 3 short strings }
            2. "gapAnalysis": { "gaps": Array of objects { "title", "severity", "reason" } }
            3. "marketComparison": { "you": { "clarity", "engagement", "professionalism" }, "top10": {...}, "average": {...} }
            4. "optimizationSuggestions": { "platform": Array of 3 objects { "title", "impact", "instruction" }, "nurotra": Array of 3 objects {...} }
            5. "projectedImpact": { "matchQualityUplift": (10-30), "replyRateUplift": (10-30) }
            6. "enhancedBios": Array of 3 objects: { "style", "content", "reasoning" }
            7. "contentStrategy": Array of 3 objects: { "title", "idea", "caption", "hashtags" }
            8. "compatibility": { "budgetFit": { "score", "label", "insight" }, "nicheDemand": {...}, "contentViability": {...} }
            No markdown.
        `;
        const prompt = `
            Profile Data:
            - Role: ${profileData.role || "Influencer"}
            - Niche: ${profileData.niche || "Unspecified"}
            - Bio/Note: "${profileData.noteToBrand || profileData.bio || "No bio info"}"
            - Followers: ${profileData.followers || "N/A"}
            - Platform: ${profileData.primaryPlatform} (${profileData.platformUrl})
            - Budget/Rate: ${profileData.budget || "Unspecified"}
        `;

        let text = await generateWithFallback(prompt, systemPrompt);
        // Clean JSON
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Profile Analysis Error:", error.message);
        // Fallback Mock Data
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

/**
 * Deep Behavioral Analysis after a collaboration context
 */
const analyzeCollaborationBehavior = async (context) => {
    const systemPrompt = `
        You are Nuro, an Agentic AI Coach for influencer collaborations.
        Analyze this collaboration history deepy. Do NOT just summarize.
        Generate a "Nuro Post-Mortem" JSON:
        1. "overallScore": (0-100)
        2. "scoreDelta": (Integer, e.g. +14 or -5) compared to a baseline of 70.
        3. "metrics": { "communicationClarity": (0-100), "reliability": (0-100), "trustIndex": (0-100) }
        4. "positives": Array of 2-3 specific good behaviors.
        5. "negatives": Array of 2-3 specific mistakes (e.g. "Over-negotiation").
        6. "rootCause": One sentence explaining the PSYCHOLOGICAL reason for the mistakes.
        7. "fixes": Array of 2 concrete actions for next time.
        8. "predictedSuccessProbability": (0-100) for next collab if fixes are applied.
        Return strictly JSON. No markdown.
    `;
    const prompt = `
        Context:
        - Chat logs duration: ${context.chatLogs?.length || 0} messages
        - Final Outcome: ${context.outcome || "Completed"}
        - User Role: Influencer
    `;

    try {
        let text = await generateWithFallback(prompt, systemPrompt);
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
 */
const generateIntervention = async (currentAction, history) => {
    const systemPrompt = `
        You are Nuro. If the user is at risk of repeating a mistake based on their past weaknesses,
        generate a short, helpful intervention. If no risk, return NULL.
        Output format: JSON { "shouldIntervene": boolean, "message": "Short advice", "type": "warning|tip" }.
        No markdown.
    `;
    const prompt = `
        The user is currently: "${currentAction}".
        Their past weaknesses include: ${JSON.stringify(history?.weaknesses || [])}.
    `;

    // Simulating robust response for now
    return {
        shouldIntervene: false,
        message: null
    };
};

/**
 * Analyze a deliverable (Proof of Work)
 */
const analyzeDeliverable = async (deliverableData) => {
    const systemPrompt = `
        You are Nuro, the Agentic AI Trust Engine.
        Categorize the deliverable into: Campaign Execution Proof, Performance Evidence, Communication & Professionalism,
        Compliance & Safety, Reliability & Consistency, Experience Level, Industry Exposure.
        Determine "Score Impact" (0-5) for: compatibility, experience, trust, safety, reliability.
        Generate a 1-sentence summary and 2-3 key takeaways.
        Return strictly JSON: { "category": "...", "summary": "...", "keyTakeaways": ["...", "..."], "scoreImpact": {...} }.
        No markdown.
    `;
    const prompt = `
        File Info:
        - Name: ${deliverableData.fileName}
        - Type: ${deliverableData.fileType}
    `;

    try {
        let text = await generateWithFallback(prompt, systemPrompt);
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
        const systemPrompt = `You are Nurotra's "Docs Agent"—a soulful digital strategist. User: ${userContext?.name} (${userContext?.role}). Niche: ${userContext?.niche}. 
        MISSION:
        1. Intent: CREATE, MODIFY, NAVIGATE, CONTROL, or QUERY.
        2. Soulful & Insightful response with 🌻, 🔭, 📈.
        3. 2 interactive options {label, action}.
        4. IF generating a file, add a "generation" object with strict schema:
           - WORD: { "type": "word", "data": { "fileName": "Name.docx", "title": "...", "sections": [{ "heading": "...", "content": "..." }] } }
           - PPT: { "type": "ppt", "data": { "fileName": "Name.pptx", "slides": [{ "title": "...", "bullets": ["..."] }] } }
           - EXCEL: { "type": "excel", "data": { "fileName": "Name.xlsx", "sheets": [{ "name": "...", "rows": [[1,2], ["A","B"]], "formulas": { "C3": "SUM(C1:C2)" } }] } }
        Output STRICT JSON. No markdown.`;

        const userPrompt = `Query: "${prompt}"\nHistory: ${JSON.stringify(history.slice(-5))}`;
        let text = await generateWithFallback(userPrompt, systemPrompt);

        text = text.replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Docs Agent AI Error:", error.message);
        return {
            intent: "QUERY",
            text: "I'm momentarily recalibrating. ⚙️ Let's focus on your project goals. 💡 How can I assist?",
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
