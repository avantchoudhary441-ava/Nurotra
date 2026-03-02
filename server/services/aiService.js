const axios = require("axios");

// Simple In-Memory Cache for Cost Saving
const responseCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 Hour

/**
 * API Key Reservoir & Rotation
 * Supports GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3...
 */
const getApiKeys = () => {
    const keys = [];
    if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
    let i = 2;
    while (process.env[`GEMINI_API_KEY_${i}`]) {
        keys.push(process.env[`GEMINI_API_KEY_${i}`]);
        i++;
    }
    return keys;
};

let currentKeyIndex = 0;

/**
 * Direct Gemini Generation using Raw REST (Axios)
 * Bypasses SDK limits and reservoir complexity.
 * Implements Multi-Key Rotation & Model Fallback.
 */
const generateWithFallback = async (prompt, systemPrompt = "") => {
    const cacheKey = Buffer.from(prompt + systemPrompt).toString('base64').substring(0, 32);
    if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
        throw new Error("No GEMINI_API_KEY found in environment");
    }

    const geminiModels = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-pro"];
    let lastError = null;

    // Outer Loop: API Keys (The Reservoir)
    for (let k = 0; k < apiKeys.length; k++) {
        const keyAttemptIndex = (currentKeyIndex + k) % apiKeys.length;
        const apiKey = apiKeys[keyAttemptIndex];

        // Inner Loop: Models (The Fallback)
        for (const modelName of geminiModels) {
            let retries = 0;
            const maxRetries = 1;

            while (retries <= maxRetries) {
                try {
                    console.log(`Debug: Key ${keyAttemptIndex + 1}/${apiKeys.length} | Model: ${modelName} | Retry: ${retries}`);
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

                    const response = await axios.post(url, {
                        contents: [{
                            parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }]
                        }],
                        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }
                    });

                    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                        const text = response.data.candidates[0].content.parts[0].text.trim();
                        // Update current starting key for next request (load balancing)
                        currentKeyIndex = keyAttemptIndex;
                        responseCache.set(cacheKey, { data: text, timestamp: Date.now() });
                        return text;
                    }
                    throw new Error("Invalid response format");
                } catch (gError) {
                    const errorMsg = gError.response?.data?.error?.message || gError.message;
                    const statusCode = gError.response?.status;

                    console.warn(`Debug: Key ${keyAttemptIndex + 1} | Model ${modelName} failed: ${errorMsg}`);

                    // If Quota Exceeded, break model loop and try next key immediately OR try next model
                    // Usually, 429 means THIS key is out of quota for THIS model or ALL models.
                    if (statusCode === 429 || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit")) {
                        console.log(`Debug: Key ${keyAttemptIndex + 1} hit quota. Trying next fallback...`);
                        lastError = new Error(`Quota Exceeded: ${errorMsg}`);
                        break; // Try next model with same key, or if all models fail, next key
                    }

                    if (statusCode === 503 && retries < maxRetries) {
                        await new Promise(r => setTimeout(r, 2000));
                        retries++;
                        continue;
                    }

                    lastError = new Error(`Gemini Error (${modelName}): ${errorMsg}`);
                    break; // Next model
                }
            }
        }
        // If we reach here, this key failed for all models
        console.warn(`Debug: Key ${keyAttemptIndex + 1} exhausted for all models.`);
    }

    throw lastError || new Error("All API keys and models in the reservoir have failed.");
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
        Output STRICT JSON:
        {
          "intent": "CREATE" | "MODIFY" | "QUERY" | "DATA_OP" | "CONVERT",
          "category": "Marketing|Legal|Technical|Education|Financial|General",
          "reasoning": "1-sentence explanation"
        }`;

        let text = await generateWithFallback(prompt, systemPrompt);
        text = text.replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Intent Rescue Failure:", error.message);
        return { intent: "QUERY", category: "General", reasoning: "Fallback due to error" };
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
        const advancedOps = preParsed?.advancedOps || []; // NEW: Advanced operation codes
        // Determine document type from user prompt (via intent engine) — NOT from AI-generated filename,
        // because that creates a self-fulfilling loop where a wrong filename locks in the wrong template.
        const { detectDocType } = require('./intentEngine');
        const { type: docType } = detectDocType(prompt);

        // =====================================================================
        // ADVANCED WORD OPERATIONS: Buildable Prompt Blocks
        // Only injected when the intent engine has detected they are needed.
        // This keeps simple prompts fast and clean.
        // =====================================================================
        const buildAdvancedWordFeatures = (ops) => {
            if (!ops || ops.length === 0) return '';

            let block = `\n        ADVANCED WORD FEATURES — ACTIVE FOR THIS REQUEST:\n        You have detected advanced operations in the user's prompt. You MUST use the following special block types where appropriate:\n`;

            if (ops.includes('MULTI_AUTHOR_MERGE')) {
                block += `
        --- MULTI-AUTHOR & COLLABORATION ---
        Use "author_section" blocks to attribute each section to its contributor.
        Use "revision_log" to show change history at the end of the document.
        Use "protection" with mode "tracked_changes" to simulate track-changes mode.

        BLOCK SCHEMAS:
        { "type": "author_section", "author": "Dr. Ananya Rao", "institution": "IIT Delhi", "role": "Lead Contributor", "heading": "Section Title", "blocks": [ ...normal content blocks... ] }
        — Use this instead of a plain heading when a section belongs to a specific contributor.
        — The "blocks" array inside can contain any normal block type (paragraph, bullet, table, etc.).

        { "type": "revision_log", "title": "Revision History", "entries": [
            { "version": "v1.0", "author": "Author Name", "date": "YYYY-MM-DD", "change": "Brief description of what was changed" }
        ]}
        — Place this as the LAST section of the document.
        — Include at least 3 realistic revision entries with different authors/dates.

        { "type": "protection", "mode": "tracked_changes" }
        — Add this as a standalone block in the document-level metadata area.
`;
            }

            if (ops.includes('NAVIGATION_STRUCTURE')) {
                block += `
        --- NAVIGATION PANE & TABLE OF CONTENTS ---
        Add a "toc" block immediately after the cover page (if any) or as the first content section.
        Add "bookmark" blocks before each major chapter heading — this enables Word's Navigation Pane.

        BLOCK SCHEMAS:
        { "type": "toc", "title": "Table of Contents", "depth": 3 }
        — Place this early in the document. It will render as a structured heading list.
        — "depth" controls how many heading levels (1=major, 2=chapter, 3=sub-chapter).

        { "type": "bookmark", "id": "chapter_1_global_overview", "label": "Chapter 1: Global Overview" }
        — Place a bookmark BEFORE each major section heading block.
        — Use snake_case IDs. These become Navigation Pane anchors in Word.
        — Every "level 1" heading section MUST have a bookmark.
`;
            }

            if (ops.includes('METADATA_INSPECTION')) {
                block += `
        --- METADATA INSPECTION & SANITIZATION ---
        Add a "metadata_clean" block at the top level of the document data. This will be processed by the export engine to strip hidden properties before saving.

        BLOCK SCHEMA:
        { "type": "metadata_clean", "strip": ["creator", "lastModifiedBy", "revision", "description", "subject", "keywords"], "replacement": { "creator": "Nurotra Docs Agent", "lastModifiedBy": "" } }
        — "strip" lists which docProps fields to clear.
        — "replacement" optional: sets a sanitized value (e.g., replace author with "Nurotra Docs Agent").
        — Place this as a block in the FIRST section of the document.
`;
            }

            if (ops.includes('STYLE_MANAGEMENT')) {
                block += `
        --- STYLE MANAGEMENT ---
        Use "styled_paragraph" blocks instead of plain paragraphs for content where named Word styles would be appropriate.

        BLOCK SCHEMA:
        { "type": "styled_paragraph", "style_name": "Heading 1|Heading 2|Heading 3|Normal|Quote|Caption|Body Text|Intense Quote", "text": "...", "style": {} }
        — "style_name" must be one of the exact values above.
        — This ensures proper Word style application for formatting consistency.
        — Use "Heading 1", "Heading 2", "Heading 3" for section titles (NOT plain headings in sections).
        — Use "Quote" or "Intense Quote" for testimonials, references, pull-quotes.
        — Use "Caption" for figure/table labels.
        — Use "Body Text" for the main prose content.
        — Mix "styled_paragraph" with normal "paragraph" as needed.
`;
            }

            if (ops.includes('DOCUMENT_PROTECTION')) {
                block += `
        --- DOCUMENT PROTECTION ---
        { "type": "protection", "mode": "read_only" }   — Full read-only, no editing permitted.
        { "type": "protection", "mode": "form_fields" }  — Only form fields (fillable tables) can be edited.
        { "type": "protection", "mode": "tracked_changes" } — All edits are tracked as revisions.
        — Choose the mode that best matches the user's request.
        — Only ONE protection block per document.
`;
            }

            block += `\n        ALWAYS use these advanced blocks in addition to regular blocks. Do NOT ignore them just because they are new — they are required for this prompt.\n`;
            return block;
        };



        // Build format-specific instructions
        let formatInstructions = '';
        if (docType === 'word') {
            formatInstructions = `
        WORD DOCUMENT CONTENT RULES (MOST IMPORTANT):
        You are generating a REAL, PROFESSIONAL document. Follow these rules strictly:

        1. WRITE ACTUAL CONTENT. Every section MUST have real, meaningful paragraphs.
           - DO NOT just write headings and leave them empty.
           - DO NOT just list field labels like "Name: [Your Name]" without context.
           - WRITE sentences and paragraphs that explain, describe, and provide value.
           - Example: Instead of just "Name: [Your Name]", write: "My name is {{Your Full Name}}. I am a student currently enrolled at {{Your College Name}}, pursuing {{Your Course/Degree}}."

        2. PLACEHOLDER SYNTAX for unknown/personal data:
           - Use double curly braces: {{Your Name}}, {{Your College}}, {{Enter Date Here}}
           - These will be auto-highlighted in yellow in the final Word document.
           - ONLY use placeholders for data you genuinely don't know (user's name, specific dates, personal details).
           - For generic content (descriptions, explanations), WRITE the actual text yourself.

        3. COLLABORATIVE PLACEHOLDERS — Make the user part of the process:
           - Beyond personal data, include 2-3 placeholders PER DOCUMENT that invite user INPUT and DECISIONS.
           - Examples of collaborative placeholders:
             * {{Your thoughts on this approach}}
             * {{Add any additional requirements here}}
             * {{Your preferred timeline for this project}}
             * {{Describe your specific goals for this section}}
             * {{Your key priorities — list what matters most to you}}
           - Place these at natural decision points in the document so the user personalizes their output.
           - This makes every document feel like a COLLABORATION, not just a generation.

        4. INTELLIGENT FORMATTING — choose the EXACT right block type for each content need:
           - "paragraph": For explanatory text, descriptions, introductions. Include a "style" object for bold/italic/underline.
           - "bullet": For unordered lists (features, items, hobbies, skills).
           - "numbered": For ordered sequences (steps, rankings, procedures).
           - "subheading": For sub-sections within a main heading (level 2 or 3).
           - "table": For field-value pairs, simple comparisons. Use "headers" and "rows".
           - "formula_table": For data with totals/averages/min/max. Provide raw numbers; totals will be auto-computed.
           - "image": When user asks to insert a logo, chart, photo, or diagram.
           - "cover_page": For the very first page of formal reports, proposals, or projects.
           - "page_break": Between major sections to start on a fresh page.
           - "watermark": When document needs "Confidential", "Draft", or similar background text.

        5. ABSOLUTE BAN ON PIPE CHARACTERS:
           - NEVER use "|" (pipe) characters to separate data. This is CRITICAL.
           - If data has 2+ columns, you MUST use { "type": "table" } or { "type": "formula_table" }.
           - If data is a simple list, use "bullet" or "numbered" blocks.
           - NEVER write lines like "Name | Value | Description" — that is UNACCEPTABLE.

        6. STYLE within paragraphs:
           - "bold": array of exact substrings to bold, e.g. ["important term", "key phrase"]
           - "italic": array of substrings to italicize
           - "underline": array of substrings to underline
           - "align": "left" | "center" | "right" (default: "left")
           - "fontSize": number in half-points (default 24 = 12pt). Use 28 for emphasis, 20 for fine print.

        7. DOCUMENT-LEVEL FEATURES (top-level in "data", alongside "sections"):
           - "header": string — text shown at top of every page (e.g., project title)
           - "footer": string — text shown at bottom; use "{{page_number}}" and "{{file_name}}" as dynamic tokens
           - "watermark": string — diagonal background text (e.g., "Confidential", "Draft")
           - "protection": { "readOnly": true, "allowFormFields": true } — restrict editing

        8. TITLE FORMATTING:
           - "titleStyle" in data object: { "bold": true, "underline": true, "align": "center", "fontSize": 32 }
           - Always apply formatting that the user requests for the title.

        9. MINIMUM CONTENT RULE: Each section MUST have at least 2-3 blocks of content. A section with only a heading is UNACCEPTABLE.

        10. ALWAYS BUILD, NEVER META-DESCRIBE:
            - NEVER create a single table that DESCRIBES what sections/chapters "would" contain.
            - If a user asks for chapters, sections, or parts — CREATE EACH ONE as its own section object
              with a heading, level, and blocks containing real written content.
            - A table summarizing section names is NOT a document. Build each section fully.
            - This applies regardless of document length — whether 2 sections or 20.
            - Think of yourself as an AUTHOR, not an outliner.

        11. SCALE-AWARE DOCUMENT ARCHITECTURE:
            - Match the DEPTH and LENGTH of your output to the complexity of the user's prompt.
            - Short/casual prompt (e.g., "make a leave application") → 2-4 sections, concise content.
            - Detailed/structured prompt (e.g., "create a thesis with chapters, TOC, bibliography")
              → Create EVERY requested section fully, use cover_page, page_break between major parts.
            - If the user asks for specific parts (declaration, acknowledgment, abstract, chapters, bibliography),
              create ALL of them as separate sections — do not collapse them into a table.
            - For a "Table of Contents" or "summary": create a TABLE block that lists section names
              with brief summaries — placed BEFORE the main content, not AS the entire document.
            - For "Bibliography" or "References": use a NUMBERED block with formatted citation entries.
            - Adapt naturally. No two prompts are the same — read the intent and scale accordingly.

        12. FILLABLE / FORM TABLES:
            - When user says "leave blank", "for employees to fill", "keep response empty", or similar:
            - Use a TABLE block with empty string "" in cells meant for human input.
            - This is DIFFERENT from {{placeholders}} — empty cells are for writing in Word later.
            - Example: headers ["Topic", "Summary", "Employee Response"],
              rows [["Quality", "87% satisfaction", ""], ["Delivery", "Avg 3.2 days", ""]]

        FULL WORD SCHEMA WITH ALL FEATURES:
        {
          "intent": "${intent}",
          "text": "Brief action summary.",
          "generation": {
            "type": "word",
            "data": {
              "fileName": "Descriptive_Name.docx",
              "title": "Document Title",
              "titleStyle": { "bold": true, "underline": false, "align": "center", "fontSize": 32 },
              "header": "Annual Sales Performance Analysis — Confidential",
              "footer": "Page {{page_number}} | {{file_name}}",
              "watermark": "Confidential",
              "protection": { "readOnly": false, "allowFormFields": true },
              "sections": [
                {
                  "heading": "",
                  "level": 1,
                  "blocks": [
                    { "type": "cover_page", "title": "Annual Sales Performance Analysis", "subtitle": "Q4 FY2024 Report", "company": "{{Your Company Name}}", "date": "{{Report Date}}", "logo_url": "" }
                  ]
                },
                {
                  "heading": "Executive Summary",
                  "level": 1,
                  "blocks": [
                    { "type": "page_break" },
                    { "type": "paragraph", "text": "This report presents a comprehensive analysis of annual sales performance...", "style": { "bold": ["comprehensive analysis"], "italic": [], "underline": [], "align": "left" } },
                    { "type": "bullet", "items": ["Total Revenue: $4.2M", "YoY Growth: 18%", "Top Region: {{Your Top Region}}"] },
                    { "type": "paragraph", "text": "{{Your key observations and strategic priorities for next year}}", "style": {} }
                  ]
                },
                {
                  "heading": "Sales Data",
                  "level": 1,
                  "blocks": [
                    { "type": "formula_table", "headers": ["Region", "Q1", "Q2", "Q3", "Q4"], "rows": [["North", 120000, 135000, 148000, 162000], ["South", 98000, 105000, 112000, 119000]], "formulas": [{"column": "Total", "operation": "SUM"}, {"column": "Average", "operation": "AVERAGE"}], "conditionalShading": {"highlightMax": "C6EFCE", "highlightMin": "FFC7CE"} },
                    { "type": "paragraph", "text": "{{Your analysis of the sales data above}}", "style": {} }
                  ]
                },
                {
                  "heading": "Visual Reference",
                  "level": 1,
                  "blocks": [
                    { "type": "image", "url": "", "caption": "Company Logo", "width": 150, "height": 80 },
                    { "type": "paragraph", "text": "The logo above represents our brand identity...", "style": {} }
                  ]
                }
              ]
            }
          }
        }`;
        } else if (docType === 'excel') {
            formatInstructions = `
        EXCEL RULES:
        - NEVER use Markdown tables. ALWAYS use the "sheets" array with "rows" and "cells".
        - EXCEL FORMULAS: Use formulas for ANY calculated data (e.g., "=C2+D2", "=SUM(B2:B10)").
        - EXCEL FORMATTING: Add "conditionalFormatting" for visual alerts (Data Bars, Color Scales, Highlighting).
        - EXCEL VALIDATION: Add "dataValidation" to cells to prevent invalid entries.

        EXCEL SCHEMA:
        {
          "intent": "${intent}",
          "text": "Brief summary.",
          "generation": {
            "type": "excel",
            "data": {
              "fileName": "Name.xlsx",
              "sheets": [{
                "name": "Sheet1",
                "headers": ["ColA", "ColB"],
                "rows": [{ "cells": [{ "value": "100", "formula": "", "dataValidation": {} }] }],
                "conditionalFormatting": [
                  { "ref": "A2:A10", "rules": [{ "type": "colorScale", "cfvo": [{"type":"min"},{"type":"max"}], "color": [{"argb":"FFFFAAAA"},{"argb":"FFAAFF88"}] }] }
                ]
              }]
            }
          }
        }`;
        } else {
            formatInstructions = `
        POWERPOINT SCHEMA:
        {
          "intent": "${intent}",
          "text": "Brief summary.",
          "generation": {
            "type": "ppt",
            "data": {
              "fileName": "Name.pptx",
              "slides": [{ "title": "Slide Title", "bullets": ["Point 1", "Point 2"] }]
            }
          }
        }`;
        }

        // Append advanced features block for Word documents (empty string for Excel/PPT)
        if (docType === 'word' && advancedOps.length > 0) {
            formatInstructions += buildAdvancedWordFeatures(advancedOps);
        }

        const systemPrompt = `You are the Nurotra Content Architect.
        MISSION: Generate structured JSON for a ${intent} action on a ${docType.toUpperCase()} document.
        CRITICAL: The output document type MUST be "${docType}". Do NOT change it to excel, word, or ppt unless the user explicitly asked for a different format.
        
        CRITICAL RULES:
        - Output ONLY valid JSON. No markdown, no commentary.
        - The "type" field in "generation" MUST be "${docType}". Do NOT deviate from this.
        - FILENAME: Propose a semantic, descriptive name with the correct extension (${docType === 'ppt' ? '.pptx' : docType === 'excel' ? '.xlsx' : '.docx'}). No spaces.
        ${currentDoc ? '- ITERATIVE EDIT: You are modifying an existing document. PRESERVE all existing data/sections unless explicitly asked to change or delete them.' : ''}
        
        ${currentDoc ? `EXISTING DOCUMENT CONTEXT (JSON):
        ${JSON.stringify(currentDoc.rawStructure || { content: currentDoc.content }, null, 2)}` : ''}

        ${formatInstructions}`;

        const userPrompt = `Request: "${prompt}"`;
        let rawResponse = await generateWithFallback(userPrompt, systemPrompt);

        // Aggressive JSON Cleaning
        let cleanJson = rawResponse
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .replace(/^[^[{]*/, "")
            .replace(/[^\]}]*$/, "")
            .trim();

        let parsed;
        try {
            parsed = JSON.parse(cleanJson);
        } catch (jsonError) {
            console.warn("JSON Parse Error, attempting repair...", jsonError.message);
            try {
                const repaired = repairJson(cleanJson);
                parsed = JSON.parse(repaired);
            } catch (repairError) {
                console.error("Repair failed:", repairError.message);
                if (rawResponse.toLowerCase().includes("interference") || rawResponse.toLowerCase().includes("cannot")) {
                    throw new Error("AI engine refusal detected. System is recalibrating safety parameters.");
                }
                throw jsonError;
            }
        }

        // Post-processing: ensure Word sections are never empty
        if (parsed?.generation?.type === 'word' && parsed.generation.data?.sections) {
            parsed.generation.data.sections = parsed.generation.data.sections.map(sec => {
                // If the section has blocks, ensure they're not empty
                if (sec.blocks && Array.isArray(sec.blocks) && sec.blocks.length > 0) {
                    return sec;
                }
                // If section uses old flat content format, convert to blocks
                if (sec.content && typeof sec.content === 'string' && sec.content.trim()) {
                    const paragraphs = sec.content.split('\n').filter(p => p.trim());
                    return {
                        ...sec,
                        blocks: paragraphs.map(p => ({ type: 'paragraph', text: p, style: {} }))
                    };
                }
                // If section is empty, inject a safety paragraph
                return {
                    ...sec,
                    blocks: [{ type: 'paragraph', text: `This section covers ${sec.heading || 'additional details'}. Please add your content here.`, style: { italic: [`Please add your content here.`] } }]
                };
            });
        }

        return parsed;
    } catch (error) {
        console.error("Docs Agent Execution Error:", error.message);
        return {
            intent: "QUERY",
            text: `System alert: ${error.message}. The cognitive engine is momentarily unstable. 🔭`,
            clarification: {
                options: [
                    { label: "Retry Generation", action: "RETRY" },
                    { label: "View Support Docs", action: "HELP" }
                ]
            }
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
    extractIntentWithLLM
};
