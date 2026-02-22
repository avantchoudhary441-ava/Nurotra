/**
 * Docs Agent Intent Engine (Invisible Intelligence Layer)
 * Handles deterministic, rule-based logic with confidence scoring.
 */

const INTENT_WEIGHTS = {
    CREATE: { keywords: ['create', 'make', 'generate', 'build', 'new', 'start'], weight: 1.0 },
    MODIFY: { keywords: ['edit', 'change', 'update', 'fix', 'refine', 'revise', 'modify', 'calculate', 'sum', 'average', 'addition', 'math', 'total', 'arithmetic'], weight: 0.9 },
    QUERY: { keywords: ['what', 'how', 'who', 'analyze', 'explain', 'search', 'tell me'], weight: 0.8 },
    DATA_OP: { keywords: ['merge', 'sort', 'filter', 'calculate', 'clean', 'duplicate', 'sum', 'average'], weight: 1.0 },
    CONVERT: { keywords: ['turn into', 'convert', 'summarize to', 'transform', 'translate'], weight: 1.0 },
};

const CATEGORY_MAP = {
    Marketing: ['marketing', 'brand', 'social media', 'campaign', 'ad', 'promotion', 'influencer'],
    Legal: ['contract', 'agreement', 'terms', 'privacy', 'legal', 'compliance'],
    Technical: ['code', 'api', 'documentation', 'tech', 'software', 'spec', 'debug'],
    Education: ['study', 'lesson', 'tutor', 'learn', 'course', 'academic'],
    Financial: ['budget', 'expense', 'revenue', 'finance', 'profit', 'accounting', 'sales'],
};

const RISK_KEYWORDS = ['delete', 'overwrite', 'remove', 'replace', 'wipe', 'reset', 'clear'];

const FILLER_WORDS = ['um', 'uh', 'like', 'actually', 'basically', 'sort of', 'you know', 'mean', 'just', 'highly', 'really'];

/**
 * Classify intent with confidence scoring
 */
const classifyIntent = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();
    let bestIntent = 'QUERY';
    let maxScore = 0;

    // Count matches across all intents
    const matches = {};

    for (const [intent, data] of Object.entries(INTENT_WEIGHTS)) {
        let count = 0;
        data.keywords.forEach(kw => {
            if (lowerPrompt.includes(kw)) count++;
        });

        if (count > 0) {
            // Score = presence * weight / (total words in prompt roughly)
            const score = (count * data.weight) / (prompt.split(' ').length > 5 ? 1.5 : 1);
            matches[intent] = Math.min(score, 1.0);

            if (score > maxScore) {
                maxScore = score;
                bestIntent = intent;
            }
        }
    }

    // Adjust confidence if multiple strong matches exist (ambiguity)
    let confidence = maxScore;
    const sortedMatches = Object.values(matches).sort((a, b) => b - a);
    if (sortedMatches.length > 1 && (sortedMatches[0] - sortedMatches[1] < 0.2)) {
        confidence *= 0.7; // Reduce confidence due to ambiguity
    }

    return {
        intent: bestIntent,
        confidence: Math.min(confidence, 1.0),
        isAmbiguous: confidence < 0.8
    };
};

/**
 * Detect document type with confidence
 */
const detectDocType = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();
    let type = 'word'; // Default to word
    let confidence = 0.5;

    const map = {
        ppt: ['ppt', 'presentation', 'slide', 'powerpoint', 'deck'],
        excel: ['excel', 'sheet', 'spreadsheet', 'csv', 'table', 'data'],
        word: ['word', 'doc', 'report', 'letter', 'essay', 'draft']
    };

    for (const [t, keywords] of Object.entries(map)) {
        if (keywords.some(kw => lowerPrompt.includes(kw))) {
            type = t;
            confidence = 1.0;
            break;
        }
    }

    return { type, confidence };
};

/**
 * Detect risk level
 */
const detectRisk = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();
    const matches = RISK_KEYWORDS.filter(kw => lowerPrompt.includes(kw));
    const isHighRisk = matches.length > 0;

    return {
        isHighRisk,
        riskScore: isHighRisk ? 0.9 : 0.1,
        reason: isHighRisk ? `Action involves destructive modifiers: ${matches.join(', ')}.` : null
    };
};

/**
 * Generate smart filename and category
 */
const generateMetadata = (prompt, overrideIntent = null, overrideCategory = null) => {
    const lowerPrompt = prompt.toLowerCase();
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '');

    const { intent: baseIntent, confidence } = classifyIntent(prompt);
    const intent = overrideIntent || baseIntent;
    const { type } = detectDocType(prompt);

    // Detect Category
    let category = overrideCategory || 'General';
    if (!overrideCategory) {
        for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
            if (keywords.some(kw => lowerPrompt.includes(kw))) {
                category = cat;
                break;
            }
        }
    }

    // Smart Naming
    let nameHint = category !== 'General' ? category : "Nuro";
    const words = prompt.split(' ').filter(w => w.length > 3);
    if (words.length > 0) {
        // Find a significant word that isn't a keyword
        const allKeywords = Object.values(INTENT_WEIGHTS).flatMap(d => d.keywords);
        const significant = words.find(w => !allKeywords.includes(w.toLowerCase()));
        if (significant) {
            nameHint = significant.charAt(0).toUpperCase() + significant.slice(1).toLowerCase();
        }
    }

    const ext = type === 'ppt' ? '.pptx' : (type === 'excel' ? '.xlsx' : '.docx');

    return {
        name: `${nameHint}_${dateStr}${ext}`,
        category,
        purpose: `Hybrid ${category} execution`,
        entities: [],
        confidenceScore: confidence
    };
};

/**
 * Clean voice transcripts deterministically
 */
const cleanVoiceTranscript = (transcript) => {
    if (!transcript) return "";

    let cleaned = transcript.toLowerCase();

    // Remove fillers
    FILLER_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '');
    });

    // Remove repeated words
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');

    // Remove conversational "please", "can you", etc.
    const fluff = ['please', 'can you', 'could you', 'i want to', 'i would like to', 'if you can'];
    fluff.forEach(phrase => {
        cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '');
    });

    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
};

module.exports = {
    classifyIntent,
    detectDocType,
    detectRisk,
    generateMetadata,
    cleanVoiceTranscript
};
