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

    // Smart Naming — extract multiple significant words for meaningful names
    const allIntentKeywords = Object.values(INTENT_WEIGHTS).flatMap(d => d.keywords);
    const docTypeKeywords = ['excel', 'sheet', 'spreadsheet', 'csv', 'word', 'doc', 'report', 'ppt', 'presentation', 'slide', 'powerpoint', 'table', 'data', 'document', 'file'];
    const stopWords = [...FILLER_WORDS, 'the', 'a', 'an', 'for', 'and', 'with', 'about', 'this', 'that', 'from', 'into', 'on', 'in', 'of', 'to', 'my', 'our', 'me', 'we', 'it'];
    const allFilterWords = new Set([...allIntentKeywords, ...docTypeKeywords, ...stopWords]);

    const words = prompt.split(/[\s,]+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length > 2 && !allFilterWords.has(w.toLowerCase()));

    // Take up to 3 significant words for the name
    let nameParts = [];
    if (words.length > 0) {
        nameParts = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }

    // Fallback to category if no significant words found
    if (nameParts.length === 0) {
        nameParts = [category !== 'General' ? category : 'Document'];
    }

    // Add date stamp for uniqueness
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStamp = `${months[now.getMonth()]}${now.getDate()}`;
    nameParts.push(dateStamp);

    const ext = type === 'ppt' ? '.pptx' : (type === 'excel' ? '.xlsx' : '.docx');

    return {
        name: `${nameParts.join('_')}${ext}`,
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
