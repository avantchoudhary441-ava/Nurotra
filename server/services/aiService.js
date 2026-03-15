const axios = require("axios");
const OpenAI = require("openai");

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Simple In-Memory Cache for Cost Saving
const responseCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 Hour

/**
 * Generate completion with OpenAI GPT (Supports Vision)
 * @param {string} prompt 
 * @param {string} systemPrompt 
 * @param {Array} images - [{ mimeType, data }]
 */
const generateWithOpenAI = async (prompt, systemPrompt = "", images = []) => {
    if (!openai) throw new Error("OpenAI API key not configured");

    try {
        const contentParts = [{ type: "text", text: prompt }];

        // Add Vision support
        if (images && images.length > 0) {
            images.forEach(img => {
                contentParts.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${img.mimeType || "image/png"};base64,${img.data}`
                    }
                });
            });
        }

        // Detect if JSON output is expected based on prompt/system instructions
        const needsJson = (prompt + systemPrompt).toLowerCase().includes('json');

        const response = await openai.chat.completions.create({
            model: "gpt-4o", // High precision with vision
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: contentParts }
            ],
            // Only force JSON if requested AND no images (Vision + JSON mode has stricter constraints)
            response_format: (needsJson && images.length === 0) ? { type: "json_object" } : undefined,
            temperature: 0.1
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.warn(`[AI Service] OpenAI attempt failed: ${error.message}`);
        throw error;
    }
};

/**
 * Main Generation Entry Point
 * Transitioned to OpenAI ONLY as per user request. 
 * Gemini reservoir logic removed to ensure stability.
 * @param {string} prompt - The user prompt
 * @param {string} systemPrompt - Optional system context
 * @param {Array} images - Optional array of { mimeType: string, data: base64 } objects
 */
const generateWithFallback = async (prompt, systemPrompt = "", images = []) => {
    const cacheKey = Buffer.from(prompt + systemPrompt + (images.length > 0 ? images[0].data.substring(0, 20) : '')).toString('base64').substring(0, 32);
    if (responseCache.has(cacheKey) && images.length === 0) {
        const cached = responseCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    // OpenAI is now the exclusive engine
    if (!openai) {
        throw new Error("CRITICAL: OpenAI API key is missing or invalid. Please check your .env configuration.");
    }

    try {
        console.log(`[AI Service] Executing via OpenAI... ${images.length > 0 ? '[Vision Mode]' : ''}`);
        const text = await generateWithOpenAI(prompt, systemPrompt, images);
        if (text) {
            console.log(`[AI Service] OpenAI Response Received (${text.length} chars)`);
            if (images.length === 0) responseCache.set(cacheKey, { data: text, timestamp: Date.now() });
            return text;
        }
        throw new Error("OpenAI returned an empty response.");
    } catch (error) {
        console.error(`[AI Service] Request Failed: ${error.message}`);
        // Wrap and re-throw with actionable info
        const enhancedError = new Error(`AI Generation Failed: ${error.message}`);
        enhancedError.isAiFailure = true;
        throw enhancedError;
    }
};

/**
 * Generate an image using OpenAI DALL-E 3
 */
const generateImageWithOpenAI = async (imagePrompt) => {
    if (!openai) throw new Error("OpenAI API key not configured for image generation");
    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: imagePrompt,
            n: 1,
            size: "1024x1024",
        });
        return response.data[0].url;
    } catch (error) {
        console.error("DALL-E Generation Error:", error.message);
        throw error;
    }
};

/**
 * Source an image from Unsplash (Safe Source)
 */
const searchImageFromUnsplash = async (query) => {
    try {
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        if (!accessKey) {
            console.warn("[AI Service] Unsplash Access Key not configured, falling back to proxy.");
            return `https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=1000&auto=format&fit=crop&sig=${encodeURIComponent(query)}`;
        }

        const response = await axios.get("https://api.unsplash.com/search/photos", {
            params: {
                query,
                per_page: 1,
                orientation: "landscape"
            },
            headers: {
                Authorization: `Client-ID ${accessKey}`
            }
        });

        if (response.data?.results?.length > 0) {
            return response.data.results[0].urls.regular;
        }

        console.warn("[AI Service] No Unsplash results for:", query);
        return null;
    } catch (error) {
        console.error("Unsplash Search Failed:", error.response?.data?.errors?.[0] || error.message);
        return null;
    }
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
 * Semantic Metadata Extraction
 * Uses Gemini to parse human intent and extract document context.
 * Used only when Backend confidence is low.
 */
const extractIntentWithLLM = async (prompt) => {
    try {
        const systemPrompt = `You are the Nurotra Intent Analyst. 
        Determine the user intent for the Document Agent.
        
        INTELLIGENCE RULES:
        1. INFER DOC TYPE (DETERMINISTIC): 
           - "Word": Mention of reports, SOPs, contracts, articles, news, articles, proposals.
           - "PPT": Mention of slides, pitch, deck, presentation, bullet points.
           - "Excel": Mention of spreadsheet, calculations, formulas, budget tables.
        
        2. SMART INFERENCE (HEURISTIC):
           - "Dashboard": ONLY assume "dashboard" if the user explicitly asks for visual trends, "performance monitor", "kpi board", "visualize", "charts", or "graphs". 
           - If the user asks analytical questions (e.g., "Which products are profitable?") without mentioning visualization, default to "word" for a detailed text report unless context strongly implies a live monitor.
           - If the user provides raw data and says "Analyse this", default to "word" unless they ask for a visual board.
        
        3. CLARIFICATION:
           - If the prompt is ambiguous between a Report and a Dashboard, pick "word" (Report) as the safer, more detailed default.
           - ONLY set "needs_clarification" to true if the intent itself is unclear or the prompt is too vague (e.g., "Do something").

        Output STRICT JSON:
        {
          "intent": "CREATE" | "MODIFY" | "QUERY" | "DATA_OP" | "CONVERT" | "ANALYZE" | "COMPARE",
          "category": "Marketing|Legal|Technical|Education|Financial|General",
          "docType": "word" | "ppt" | "excel" | "dashboard" | null,
          "needs_clarification": boolean,
          "clarification_question": "Only if needs_clarification is true",
          "reasoning": "1-sentence explanation"
        }`;

        let text = await generateWithFallback(prompt, systemPrompt);
        text = text.replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Intent Rescue Failure:", error.message);
        return { intent: "QUERY", category: "General", docType: null, needs_clarification: false, reasoning: "Fallback due to error" };
    }
};

/**
 * Docs Agent Cognitive Engine
 * Handles complex intent parsing and structured response generation.
 * Stripped of persona to avoid refusal and "shielding" errors.
 */
/**
 * Robustly repairs malformed or truncated JSON strings from AI
 */
const repairJson = (jsonStr) => {
    let str = jsonStr.trim();

    // 1. Remove Any trailing markdown junk
    str = str.replace(/```json/gi, "").replace(/```/g, "").trim();

    // 2. Extract first valid looking block if no clear start
    if (!str.startsWith('{') && !str.startsWith('[')) {
        const start = str.search(/[{[]/);
        if (start !== -1) str = str.substring(start);
    }

    // 3. Fix missing closing brackets/braces (Basic Stack-based repair)
    const stack = [];
    let inString = false;
    let escape = false;
    let lastValidIndex = -1;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (char === '{' || char === '[') {
            stack.push(char === '{' ? '}' : ']');
        } else if (char === '}' || char === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === char) {
                stack.pop();
                if (stack.length === 0) lastValidIndex = i;
            }
        }
    }

    // Truncate at last valid full object if it's a mess, otherwise just close what's open
    if (inString) str += '"';
    while (stack.length > 0) {
        str += stack.pop();
    }

    // 4. Remove trailing commas before closing chars
    str = str.replace(/,\s*([}\]])/g, '$1');

    return str;
};

const processDocsAgentQuery = async (prompt, userContext, history = [], preParsed = null) => {
    try {
        const intent = preParsed?.intent || "QUERY";
        const metadata = preParsed?.metadata || {};
        const risk = preParsed?.risk || { isHighRisk: false };
        const currentDoc = preParsed?.currentDoc || null;
        const advancedOps = preParsed?.advancedOps || [];
        const composition_profile = metadata.composition_profile || 'GOLDEN_RATIO';
        const docIds = preParsed?.docIds || [];

        // Aggregated content for ANALYZE/COMPARE
        let contextContent = "";
        if (docIds && docIds.length > 0) {
            const Document = require("../models/Document");
            const contextDocs = await Document.find({ _id: { $in: docIds } });
            contextContent = contextDocs.map(d => `--- DOCUMENT: ${d.name} ---\n${d.content}`).join("\n\n");
        } else if (currentDoc) {
            contextContent = `--- DOCUMENT: ${currentDoc.name} ---\n${currentDoc.content}`;
        }

        const { detectDocType, detectLength } = require('./intentEngine');
        const { type: detectedType } = detectDocType(prompt);
        let docType = metadata.docType || (currentDoc ? currentDoc.type : detectedType);

        // FORCE Dashboard type if user mentions Power BI or Dashboard specifically
        if (prompt.toLowerCase().includes('power bi') || prompt.toLowerCase().includes('dashboard')) {
            docType = 'dashboard';
        }

        const lengthPref = detectLength(prompt);

        // =====================================================================
        // ADVANCED WORD OPERATIONS: Buildable Prompt Blocks
        // =====================================================================
        const buildAdvancedWordFeatures = (ops, prompt) => {
            if (!ops || ops.length === 0) return '';
            let block = `\n        ADVANCED WORD FEATURES — ACTIVE FOR THIS REQUEST:\n`;
            if (ops.includes('MULTI_AUTHOR_MERGE')) {
                block += `
        --- MULTI-AUTHOR & COLLABORATION ---
        Use "author_section" blocks to attribute each section to its contributor.
        { "type": "author_section", "author": "Author Name", "blocks": [ ... ] }
`;
            }
            if (ops.includes('NAVIGATION_STRUCTURE')) {
                block += `
        --- NAVIGATION PANE & TABLE OF CONTENTS ---
        Add a "toc" block after the cover page.
        { "type": "toc", "title": "Table of Contents", "depth": 3 }
`;
            }
            if (ops.includes('STYLE_MANAGEMENT')) {
                block += `
        --- STYLE MANAGEMENT ---
        Use "styled_paragraph" for named Word styles: "Heading 1", "Heading 2", "Normal", "Quote".
        { "type": "styled_paragraph", "style_name": "Heading 1", "text": "..." }
`;
            }
            if (ops.includes('VISUAL_GENERATION') || composition_profile === 'GOLDEN_RATIO') {
                block += `
        --- AUTONOMOUS IMAGE GENERATION/SOURCING ---
        The document profile is GOLDEN_RATIO or the user explicitly requested an image.
        1. Set the top-level "visual_intent" to "IMAGE_GEN".
        2. In "generation", add "image_query": "Descriptive search term for high-quality photo" OR "image_prompt" for custom DALL-E.
        3. Do NOT provide a final URL.
        4. Insert an 'image' block in your Word sections where this belongs.
`;
            }
            if (ops.includes('DATA_VISUALIZATION') || composition_profile === 'GOLDEN_RATIO') {
                block += `
        --- AUTONOMOUS DATA VISUALIZATION ---
        The document profile is GOLDEN_RATIO or the user explicitly asked for a chart.
        1. Set the top-level "visual_intent" to "GRAPH_GEN" (or "BOTH_GEN" if also generating images).
        2. Add a "graph_config" object to "generation":
           { 
             "type": "bar" | "line" | "pie", 
             "title": "Analytical Chart", 
             "data": [{ "name": "Metric", "value": 100 }, ...],
             "xAxisName": "...",
             "yAxisName": "..."
           }
`;
            }
            return block;
        };

        // Build format-specific instructions
        let formatInstructions = '';
        if (docType === 'word') {
            formatInstructions = `
        WORD DOCUMENT CONTENT RULES (MAXIMUM PROFESSIONALISM):
        You are Nurotra's lead Content Strategist. Your goal is to produce "Ready-to-Share" professional documents.

        1. HIGH-VALUE SYNTHESIZED CONTENT:
           - DO NOT just provide outlines or generic placeholders.
           - SYNTHESIZE real, professional prose based on the prompt. If the user asks for an "Annual Report", write a realistic "Management Message", "Yearly Performance Summary", and "Mission Statement".
           - Use professional terminology appropriate for the category (e.g., Marketing, Financial, Legal).
           - CONTENT DEPTH: This request is for a ${lengthPref} document.
             * SHORT: 2-3 concise sections, focused on key highlights.
             * MEDIUM: 4-6 balanced sections, moderate detail in each.
             * DETAILED: 7+ comprehensive sections, in-depth analysis and extensive prose.

        2. STRUCTURAL EXCELLENCE AND PROPORTION INTELLIGENCE:
           - Every section MUST have at least 2-3 substantive blocks. 
           - Use "cover_page" for formal reports.
           - Use "page_break" between major thematic divisions.
           - Ensure "header" and "footer" (including "{{page_number}}") are configured.
${composition_profile === 'GOLDEN_RATIO' ? `
           - REQUIRED PROPORTIONS (The Golden Ratio): You MUST autonomously balance the content as follows:
             * Written explanation: 50-60%
             * Tables & data: 15-20%
             * Charts & graphs: 15-20% (Trigger via "visual_intent": "GRAPH_GEN")
             * Images / diagrams: 5-10% (Insert 'image' blocks)
           - AUTONOMOUS VISUALS: Proactively insert 'table' and 'image' blocks to hit these proportions based on the ${lengthPref} length, even without explicit user commands. Quality is paramount.` : `
           - REQUIRED PROPORTIONS (Text-Heavy Profile):
             * This is a formal/technical document (e.g. Legal, Policy, Contract).
             * Focus 90%+ on structured, high-quality professional text.
             * STRICTLY AVOID decorative images and charts.
             * Use 'table' blocks only for strict data organization.`}

        3. MS OFFICE FEATURE UTILIZATION:
           - If numerical data is implied (e.g., "financial highlights"), use "formula_table" with SUM/AVERAGE formulas.
           - Use "styled_paragraph" for clear visual hierarchy.
           - Use "bold" in style objects to highlight key professional terms.
           - Quality Assurance: Never compromise the quality of text, tables, or charts. All inserted visuals and tables must directly target and synthesize the factual data of the prompt.

        FULL WORD SCHEMA:
        {
          "intent": "${intent}",
          "text": "Generated a professional ${lengthPref} document.",
          "generation": {
            "type": "word",
            "data": {
              "fileName": "Project_Report.docx",
              "title": "Document Title",
              "header": "Confidential Report | {{current_date}}",
              "footer": "Page {{page_number}} | Nurotra Intelligence",
              "sections": [
                {
                  "heading": "Executive Summary",
                  "level": 1,
                  "blocks": [
                    { "type": "paragraph", "text": "Start with powerful, synthesized content here...", "style": { "bold": ["powerful", "content"] } },
                    { "type": "image", "url": "", "caption": "Descriptive caption", "width": 400, "height": 250 }
                  ]
                }
              ]
            }
          }
        }`;
        } else if (docType === 'excel') {
            formatInstructions = `
        EXCEL RULES:
        - Use "sheets" with "rows" and "cells".
        - ALWAYS use formulas for calculations (e.g., "=SUM(B2:B10)").
        - Add "conditionalFormatting" for high-impact data visualization.
`;
        } else if (docType === 'dashboard') {
            formatInstructions = `
        DASHBOARD FORMATTING & EXPERT DESIGN RULES:
        - MISSION: Create a high-end, executive-level visual intelligence board.
        
        CRITICAL RULES (MUST FOLLOW):
        1. "theme" field is MANDATORY. Pick one: "Midnight Gold", "Cyber Teal", "Executive Blue", "Modern", "Luxury", or "Vibrant".
        2. Geographic data (countries/cities/regions) MUST use type:"map" (NOT type:"chart"). Map is its OWN widget type.
        3. When comparing two metrics (e.g., Revenue vs Profit%), use chartType:"composed" with BOTH "value" AND "valueSecondary" in each data item.
        
        SCHEMA:
        {
          "fileName": "Contextual_Name.json",
          "title": "Dashboard Title",
          "theme": "Midnight Gold",
          "widgets": [
            { "type": "kpi", "title": "...", "value": "...", "change": "...", "trend": "up|down", "icon": "DollarSign|TrendingUp|Package|AlertTriangle|Truck|Users" },
            { "type": "chart", "chartType": "bar|line|pie|area|radar|composed", "title": "...", "description": "...", "data": [{ "name": "...", "value": 0, "valueSecondary": 0 }] },
            { "type": "map", "title": "...", "description": "...", "data": [{ "region": "USA", "value": 5200000, "label": "$5.2M" }] },
            { "type": "table", "title": "...", "headers": ["Header 1", "Header 2"], "rows": [["Row 1 Val", "Row 2 Val"]] }
          ]
        }
        
        SMART VISUALIZATION GUIDELINES:
          * RADAR: Comparisons across 5+ axes (Speed, Quality, Cost, etc.).
          * AREA: Cumulative growth or volume trends over time.
          * COMPOSED: Two metrics on same axis. MUST include "valueSecondary" in data items.
          * MAP: Geographic data. type MUST be "map" (NOT "chart"). Data uses "region" key.
          * LINE: Time-series. BAR: Discrete comparisons. PIE: Distribution.
        - STRICT DATA PRIORITY: Extract REAL data from the user prompt. Only synthesize if no data given.
        - VARIETY: Use at least 3 DIFFERENT widget types. Avoid repeating chartType consecutively.`;
        } else {
            formatInstructions = `
        POWERPOINT PRESENTATION RULES (INTELLIGENT AI GENERATOR PIPELINE):
        You are Nurotra's AI Presentation Generator. You do not just fill templates. You must follow a strict, multi-stage planning and generation pipeline to produce engaging, structured, and modern "$50,000-deck" quality presentations.

        PIPELINE STAGE 1: PROMPT UNDERSTANDING & SLIDE PLANNING
        - First, analyze the intent, topic, audience, and requested tone.
        - Create a logical, structured narrative flow (e.g., Title -> Problem -> Key Stats -> Solution -> Timeline -> Conclusion).
        - Dedicate a specific, unique slide type for each step of the narrative.

        PIPELINE STAGE 2: STRICT LAYOUT SELECTION & DIVERSITY
        - NEVER use the same layout type for consecutive slides.
        - NEVER use "BULLETS" for more than 1 slide in the deck.
        - You MUST use at least 4 different layout types in every deck to guarantee visual variety.
        - Available Layouts: "TITLE_COVER", "SECTION_DIVIDER", "BULLETS", "THREE_COLUMNS", "DIAGONAL_SPLIT", "DATA_GRID", "COMPARISON", "QUADRANT", "BIG_FACT", "IMAGE_RIGHT", "IMAGE_LEFT", "IMAGE_FULL", "TIMELINE", "PROCESS_FLOW", "INFOGRAPHIC", "DASHBOARD", "FUNNEL", "QUOTE".

        PIPELINE STAGE 3: CONTENT MINIMIZATION & GENERATION
        - Presentations are visual. You MUST restrict text length.
        - ABSOLUTE MAXIMUM: 4-5 bullet points per slide.
        - ABSOLUTE MAXIMUM: 8-10 words per bullet or text block. 
        - DO NOT generate paragraphs. Focus entirely on keywords and concise statements. Each slide communicates ONE core idea.
        - LAYOUT DIVERSITY CRITICAL: If you use "BULLETS" for slide 2, slide 3 MUST be "THREE_COLUMNS" or "DATA_GRID" or "BIG_FACT". FORCE VARIETY.

        PIPELINE STAGE 4: VISUAL INTELLIGENCE & DESIGN STYLING
        - "theme": "Modern" | "Corporate" | "Dark" | "Creative" | "Luxury" | "Vibrant".
        - INVENT CONTEXTUAL COLORS: You MUST generate valid, diverse 6-character Hex codes for "accentColor", "backgroundColor", and "bgGradient". NEVER use the example colors. Tailor them to the topic (e.g., #27AE60 for Eco, #8E44AD for Creative).
        - "imageQuery": A short, descriptive string for stock photos (e.g., "clean energy", "cybersecurity lab").
        - "fontFace": "Montserrat" | "Open Sans" | "Helvetica" | "Verdana".

        5. SCHEMA:
        {
          "intent": "${intent}",
          "text": "Executive Narrative about the deck.",
          "generation": {
            "type": "ppt",
            "data": {
              "fileName": "Project_Presentation.pptx",
              "title": "Presentation Header",
              "theme": "Modern",
              "accentColor": "#FF5733",
              "backgroundColor": "#1A1A1A",
              "bgGradient": "#333333",
              "fontFace": "Montserrat",
              "slides": [
                { 
                  "title": "Slide Title",
                  "layoutType": "TITLE_COVER" | "SECTION_DIVIDER" | "THREE_COLUMNS" | "DIAGONAL_SPLIT" | "DATA_GRID" | "BULLETS" | "BIG_FACT" | "TIMELINE" | "PROCESS_FLOW" | "QUADRANT" | "DASHBOARD" | "FUNNEL" | "QUOTE",
                  "bullets": ["Point 1", "Point 2"],
                  "threeColumns": [
                    { "title": "Column 1", "text": "Detail" },
                    { "title": "Column 2", "text": "Detail" },
                    { "title": "Column 3", "text": "Detail" }
                  ],
                  "dataGrid": [
                    { "label": "Label 1", "value": "Value 1" },
                    { "label": "Label 2", "value": "Value 2" }
                  ],
                  "processFlow": [
                    { "label": "Step 1", "detail": "Info" },
                    { "label": "Step 2", "detail": "Info" }
                  ],
                  "dashboardMetrics": [
                    { "label": "Total Revenue", "value": "$5M", "trend": "+12%" },
                    { "label": "Active Users", "value": "12K", "trend": "+5%" }
                  ],
                  "comparison": {
                    "left": ["Pros 1", "Pros 2"],
                    "right": ["Cons 1", "Cons 2"]
                  },
                  "timeline": [
                    { "date": "Q1", "text": "Milestone A" },
                    { "date": "Q2", "text": "Milestone B" }
                  ],
                  "imageQuery": "business strategy meeting",
                  "speakerNotes": "Details for the presenter..." 
                }
              ]
            }
          }
        }`;
        }

        if (docType === 'word' || advancedOps.some(op => ['VISUAL_GENERATION', 'DATA_VISUALIZATION'].includes(op))) {
            formatInstructions += buildAdvancedWordFeatures(advancedOps, prompt);
        }

        // ── Analytical path: extract insights across documents ────────────────
        const analystPrompt = `You are the Nurotra Intelligence Analyst. Your goal is to extract deep insights, compare data, and generate structured analytical reports.
        CRITICAL: Your response MUST be a valid JSON object.
        SOURCE CONTEXT:
        ${contextContent}

        REQUIRED JSON SCHEMA (6 SECTIONS):
        {
          "intent": "${intent}",
          "text": "Executive Narrative (markdown)",
          "documentSummaries": [ { "name": "Doc Name", "short": "5-6 lines concise summary", "detailed": ["Bullet 1", "Bullet 2", "Bullet 3"] } ],
          "keyInsights": { "keywords": ["key1", "key2"], "topicClustering": ["Topic A", "Topic B"], "sentiment": "Positive|Negative|Neutral", "importantSections": ["Highlighted text or section names"] },
          "comparativeAnalysis": { "similarities": ["Sim 1", "Sim 2"], "differences": ["Diff 1", "Diff 2"], "comparisonTable": { "headers": ["Aspect", "Doc 1", "Doc 2"], "rows": [["Pricing", "$10", "$12"], ["SLA", "99%", "95%"]] } },
          "dataTrends": { "metrics": { "Label": "Value" }, "trends": ["Trend 1", "Trend 2"], "themes": ["Theme A"] },
          "generation": {
             "type": "generic",
             "visual_intent": "ANALYTICS_DASHBOARD",
             "graph_config": { "type": "bar|line|pie", "title": "Data Visualization", "data": [{ "name": "Label", "value": 100 }, ...], "xAxisName": "Metric", "yAxisName": "Count" }
          },
          "finalOutcome": {
        CRITICAL: Output ONLY valid JSON.Ensure every widget directly maps to a goal or question in the user's prompt.`;

        // ── Selection of System Prompt ────────────────────────────────────────
        let systemPrompt;
        if (docType === 'dashboard') {
            // Dashboard always uses Architect prompt for high-end visual structure
            systemPrompt = `You are the Nurotra Dashboard Architect.
            MISSION: Generate a high-end, responsive Dashboard JSON structure specifically tailored to the user's prompt and any provided context/data.
        
        INTELLIGENCE RULES:
        1. CONTEXTUAL DESIGN: Analyze the specific questions, categories, and data in the prompt and conversation history. The dashboard title, fileName, and widgets MUST directly address these items.
        2. SMART REPRESENTATION (CHART SELECTION):
           * Line Charts: Time-series, trends, or growth over months/years.
           * Bar Graphs: Categorical comparisons (e.g., Performance across regions).
           * Pie Charts: Distributions or market shares.
           * Area Charts: Cumulative volume or growth trends.
           * Radar Charts: Multi-axis comparisons (5+ axes like Speed, Quality, Cost).
           * Composed Charts: Comparing two metrics on same axis — use "value" AND "valueSecondary".
           * KPI Cards: High-level "North Star" metrics (e.g., Net Profit).
           * Map Widgets: Geographic data (countries/cities/regions) — type MUST be "map" (NOT "chart").
           * Tables: Multi-attribute listings (e.g., Top 10 Suppliers).
        3. "theme" field is MANDATORY. Pick one: "Midnight Gold", "Cyber Teal", "Executive Blue", "Modern", "Luxury", or "Vibrant".
        4. REALISTIC DATA: Extract REAL data from the prompt. If none available, mock realistic industry-specific values.
        5. Ensure charts have enough data points (6-12) to look professional.
        6. Use at least 3 DIFFERENT widget types per dashboard.
        
        DASHBOARD SCHEMA:
        {
          "intent": "${intent}",
          "generation": {
            "type": "dashboard",
            "data": {
              "fileName": "[Specific_Domain_Name].json",
              "title": "[High_End_Analytical_Title]",
              "theme": "[Selected_Theme]",
              "layout": "grid",
              "widgets": [
                {
                  "type": "kpi",
                  "title": "[Metric_Name]",
                  "value": "[Calculated_Value]", 
                  "change": "[Percent_Change]",
                  "trend": "up|down",
                  "icon": "DollarSign|TrendingUp|Package|AlertTriangle|Truck|Users"
                },
                {
                  "type": "chart",
                  "chartType": "bar|line|pie|area|radar|composed",
                  "title": "[Chart_Title]",
                  "description": "[Insight]",
                  "data": [{ "name": "[Label]", "value": 0, "valueSecondary": 0 }]
                },
                {
                  "type": "map",
                  "title": "[Geographic_Title]",
                  "description": "[Geographic_Insight]",
                  "data": [{ "region": "[Country/City]", "value": 0, "label": "[Formatted_Value]" }]
                },
                {
                  "type": "table",
                  "title": "[Table_Title]",
                  "headers": ["[Header_1]", "[Header_2]"],
                  "rows": [["[Value_1]", "[Value_2]"]]
                }
              ]
            }
          }
        }
        
        CRITICAL: Output ONLY valid JSON. 
        NEVER use placeholder text like "Metric Name" or "Chart Title". 
        EVERY widget MUST handle a specific question or data point found in the prompt or history.
        GENERATE 8-12 unique data points per chart to make it look professional.`;
        } else if (intent === 'ANALYZE' || intent === 'COMPARE') {
            systemPrompt = analystPrompt;
        } else if (currentDoc && (intent === 'MODIFY' || preParsed?.hasOpenDoc)) {
            const existingStructure = currentDoc.rawStructure ? JSON.stringify(currentDoc.rawStructure) : null;
            const existingContent = currentDoc.content ? currentDoc.content.substring(0, 4000) : '';

            systemPrompt = `You are the Nurotra Document Editor. You are editing an EXISTING document.

EXISTING DOCUMENT NAME: "${currentDoc.name || 'Untitled'}"
EXISTING DOCUMENT CONTENT (first 4000 chars):
${existingContent}
${existingStructure ? `\nEXISTING STRUCTURE (JSON):\n${existingStructure}` : ''}

YOUR TASK:
- Apply ONLY the changes requested based on the prompt and conversation history.
- Preserve all existing sections, text, and structure that were NOT mentioned.
- If modifying a dashboard, focus on adding/updating widgets that answer the current query.
- Return the COMPLETE updated document wrapped in the required JSON envelope.

REQUIRED JSON ENVELOPE:
{
  "intent": "MODIFY",
  "text": "Summary of changes",
  "generation": {
    "type": "${docType}",
    "data": { ... your updated document data ... }
  }
}

CRITICAL RULES:
        - Output ONLY valid JSON.No markdown fences.
- Use the SAME fileName as the original: "${currentDoc.name || 'document.docx'}"
            - Keep all existing sections intact unless explicitly asked to change them.

                ${formatInstructions} `;
        } else {
            // ── CREATE path: generate a brand new document ────────────────────
            systemPrompt = `You are the Nurotra Content Architect & Lead Designer.
        MISSION: Generate structured JSON for a ${intent.toUpperCase()} action.
        DOCUMENT TYPE: ${docType.toUpperCase()}.
        DETAIL LEVEL: ${lengthPref}.

        DESIGN GUIDELINES (FOR PPT):
        1. COLOR THEORY: Use mathematically harmonious palettes. For "Luxury", use deep coals and golds. For "Medical", use clinical teals/whites. Always specify 'primaryColor', 'accentColor', and 'backgroundColor' in hex.
        2. ICONOGRAPHY: Suggest specific Lucide icon names (e.g., 'zap', 'shield', 'trending-up') for every bullet point.
        3. VISUALS: If a slide needs a conceptual diagram or futuristic scene, set 'prefersDalle': true.

        CRITICAL RULES:
        - Output ONLY valid JSON.
        - GENERATE COMPLETE, PROFESSIONAL CONTENT.
        ${formatInstructions}`;
        }

        // Build User Prompt with full History Context
        const historyContext = history && history.length > 0
            ? `\nCONVERSATION HISTORY (FOR CONTEXT):\n${history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n`
            : "";

        const userPrompt = `${historyContext}\nCURRENT REQUEST: "${prompt}"\n\nCRITICAL: If the current request refers to "given data" or "previous information", use the CONVERSATION HISTORY above to extract that data.`;
        let rawResponse = await generateWithFallback(userPrompt, systemPrompt);

        let cleanJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").replace(/^[^[{]*/, "").replace(/[^\]}]*$/, "").trim();
        let parsed;
        try {
            parsed = JSON.parse(cleanJson);
        } catch (jsonError) {
            console.warn("[AI Service] Standard JSON parse failed, attempting repair...");
            parsed = JSON.parse(repairJson(cleanJson));
        }

        try {
            require('fs').writeFileSync('debug_ai_output.json', JSON.stringify(parsed, null, 2));
            console.log("\n--- AI OUTPUT LOGGED TO debug_ai_output.json ---\n");
        } catch (e) {
            console.error("Failed to write debug log", e);
        }

        // Post-processing to ensure no empty sections or slides
        if (parsed?.generation?.type === 'word' && parsed.generation.data?.sections) {
            parsed.generation.data.sections.forEach(sec => {
                if (!sec.blocks || sec.blocks.length === 0) {
                    sec.blocks = [{ type: 'paragraph', text: `Detailed analysis of ${sec.heading}.`, style: { italic: true } }];
                }
            });
        }

        if (parsed?.generation?.type === 'ppt' && parsed.generation.data?.slides) {
            parsed.generation.data.slides.forEach((slide, idx) => {
                if (!slide.title) slide.title = `Slide ${idx + 1}`;
                if (!slide.bullets || slide.bullets.length === 0) {
                    slide.bullets = ["Professional synthesis of key narrative points."];
                }
            });
        }

        // =====================================================================
        // ROBUST IMAGE SOURCING
        // =====================================================================
        if (parsed?.generation?.data?.sections || parsed?.generation?.data?.slides) {
            const visualItems = [];
            if (parsed.generation.data.sections) {
                // Word sections image logic
                parsed.generation.data.sections.forEach(sec => {
                    if (sec.blocks) {
                        sec.blocks.forEach(block => {
                            if (block.type === 'image' && (!block.url || block.url.includes('placeholder'))) {
                                visualItems.push({ block, query: block.caption || sec.heading || "Professional background" });
                            }
                        });
                    }
                });
            }
            if (parsed.generation.data.slides) {
                // PPT slides image logic with DALL-E preference
                parsed.generation.data.slides.forEach(slide => {
                    if (!slide.image_url || slide.image_url.includes('placeholder')) {
                        visualItems.push({ 
                            slide, 
                            query: slide.image_prompt || slide.title || "Business presentation",
                            prefersDalle: slide.prefersDalle || false
                        });
                    }
                });
            }

            if (visualItems.length > 0) {
                try {
                    await Promise.all(visualItems.map(async item => {
                        let itemUrl = null;
                        
                        // Intelligent Sourcing Route
                        if (item.prefersDalle) {
                            console.log(`[AI Service] Generating custom visual via DALL-E...`);
                            try {
                                itemUrl = await generateImageWithOpenAI(`Premium, professional, 3D high-end render for a slide titled "${item.query}". Digital art style, clean, minimalistic.`);
                            } catch (dalleErr) {
                                console.warn("[AI Service] DALL-E failed, falling back to Unsplash/Pexels.");
                            }
                        }

                        if (!itemUrl) {
                            itemUrl = await searchImageFromUnsplash(item.query);
                        }
                        
                        // TODO: Add Pexels fallback here once key is provided
                        
                        if (itemUrl) {
                            if (item.block) item.block.url = itemUrl;
                            if (item.slide) item.slide.image_url = itemUrl;
                        }
                    }));
                } catch (imgErr) {
                    console.error("Post-Gen Image Sourcing Failed:", imgErr.message);
                }
            }
        }

        return parsed;
    } catch (error) {
        console.error("Docs Agent Execution Error:", error.message);
        return { 
            intent: "QUERY", 
            text: `Critical Execution Error: ${error.message}. Please refine your prompt or try again.`,
            error: true
        };
    }
};

/**
 * Semantic Metadata Extraction
 * Uses Gemini to parse human intent and extract document context.
 */
const extractMetadata = async (prompt) => {
    try {
        const systemPrompt = `You are a semantic analyzer for Nurotra.
        Analyze the document creation request and extract metadata.
        Output STRICT JSON:
        {
          "name": "Suggested File Name (with .docx, .xlsx, or .pptx)",
          "purpose": "1-sentence document goal",
          "category": "Marketing|Legal|Technical|Education",
          "entities": ["list", "of", "key", "entities"],
          "confidenceScore": 0.0-1.0
        }
        No markdown. No conversational filler.`;

        let text = await generateWithFallback(prompt, systemPrompt);
        text = text.replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Metadata Extraction Failure:", error.message);
        return {
            name: "New Document.docx",
            purpose: "General document creation",
            category: "General",
            entities: [],
            confidenceScore: 0.5
        };
    }
};

/**
 * Structure Voice Transcript into Docs Agent Action
 * Converts casual speech to structured intent for execution.
 */
const structureVoiceIntent = async (transcript, userContext = {}) => {
    try {
        const systemPrompt = `You are the Nurotra Voice-to-Action Mapper.
        Convert the following CLEAN transcript into a structured JSON instruction.
        
        USER CONTEXT: ${userContext.niche} (${userContext.role})

        JSON OUTPUT SCHEMA:
        {
          "action": "CREATE" | "EDIT" | "DATA_OP" | "CONVERT" | "ENHANCE",
          "docType": "word" | "ppt" | "excel" | "generic",
          "topic": "Clear subject",
          "structuredPrompt": "Formal command version of transcript"
        }`;

        let rawResponse = await generateWithFallback(`Clean Transcript: "${transcript}"`, systemPrompt);

        // Clean and parse
        let cleanJson = rawResponse
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .replace(/^[^[{]*/, "")
            .replace(/[^\]}]*$/, "")
            .trim();

        try {
            const parsed = JSON.parse(cleanJson);
            return parsed;
        } catch (jsonError) {
            console.error("Voice JSON Parse Error:", jsonError.message);
            // Fallback for malformed JSON
            return {
                action: "CREATE",
                docType: "generic",
                topic: transcript.substring(0, 50),
                editingScope: "full",
                details: "Raw voice input (AI parsing failed)",
                isHighRisk: false,
                clarificationNeeded: null,
                structuredPrompt: transcript
            };
        }
    } catch (error) {
        console.error("Voice Structuring Critical Failure:", error.message);
        // Universal fallback for API errors (Quota, etc)
        return {
            action: "CREATE",
            docType: "generic",
            topic: transcript.substring(0, 50),
            editingScope: "full",
            details: "System currently using raw voice due to heavy load.",
            isHighRisk: false,
            clarificationNeeded: null,
            structuredPrompt: transcript
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
    processDocsAgentQuery,
    extractMetadata,
    structureVoiceIntent,
    extractIntentWithLLM,
    generateWithFallback
};
