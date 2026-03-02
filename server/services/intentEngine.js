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
 * Advanced Word Operations Map
 * Maps operation codes to trigger keywords found in user prompts.
 */
const ADVANCED_OPS_MAP = {
    MULTI_AUTHOR_MERGE: [
        'multi-author', 'multi author', 'collaborative', 'contributor', 'contributors',
        'merge', 'combine', 'compare and combine', 'multiple authors', 'multiple versions',
        'revision history', 'track changes', 'tracked changes', 'accept changes',
        'resolve conflict', 'resolve conflicts', 'merge sections', 'master document'
    ],
    STYLE_MANAGEMENT: [
        'style', 'heading style', 'paragraph style', 'formatting consistency',
        'body text', 'apply style', 'consistent formatting', 'style management',
        'named style', 'document style', 'uniform format'
    ],
    NAVIGATION_STRUCTURE: [
        'navigation pane', 'navigation', 'navigate', 'chapter', 'chapters',
        'table of contents', 'toc', 'bookmarks', 'bookmark', 'page navigation',
        'jump to section', 'document outline', 'outline view', 'easy movement',
        'movement between chapters', 'movement between sections'
    ],
    METADATA_INSPECTION: [
        'metadata', 'hidden data', 'hidden metadata', 'document inspection',
        'inspect document', 'remove personal info', 'remove author', 'sanitize',
        'clean metadata', 'strip metadata', 'before sharing', 'remove hidden',
        'document properties', 'personal information'
    ],
    DOCUMENT_PROTECTION: [
        'protect', 'protection', 'read only', 'read-only', 'restrict editing',
        'restrict', 'lock', 'password protect', 'form fields only', 'no editing'
    ],
};

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
 * Detect document type with confidence.
 * Uses priority scoring — Word-specific structural terms are checked before
 * ambiguous terms. Removed 'table'/'data' from Excel since they appear
 * in Word docs too (e.g. "table of contents", "data analysis report").
 */
const detectDocType = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();

    // 1. Explicit file-type signals — highest priority (unambiguous)
    const explicitMap = {
        ppt: ['powerpoint', 'presentation', 'slide deck', 'pptx', ' ppt '],
        excel: ['excel', 'spreadsheet', 'xlsx', 'csv file', 'workbook'],
        word: ['word document', 'word file', 'docx', '.doc', 'word doc'],
    };
    for (const [t, keywords] of Object.entries(explicitMap)) {
        if (keywords.some(kw => lowerPrompt.includes(kw))) {
            return { type: t, confidence: 1.0 };
        }
    }

    // 2. Word-specific structural keywords — common Word doc features
    const wordKeywords = [
        'heading', 'paragraph', 'cover page', 'table of contents', 'toc',
        'page number', 'page numbering', 'roman numeral', 'arabic numeral',
        'header', 'footer', 'chapter', 'report', 'letter', 'essay',
        'proposal', 'memo', 'thesis', 'dissertation', 'summary', 'brief',
        'policy', 'notice', 'draft', 'profile', 'resume', 'cv',
        'subheading', 'formatted', 'structured heading', 'news', 'article',
        'research', 'project report', 'case study', 'documentation'
    ];
    if (wordKeywords.some(kw => lowerPrompt.includes(kw))) {
        return { type: 'word', confidence: 0.95 };
    }

    // 3. PPT keywords
    const pptKeywords = ['slide', 'deck', 'bullet point', 'keynote', 'present'];
    if (pptKeywords.some(kw => lowerPrompt.includes(kw))) {
        return { type: 'ppt', confidence: 0.9 };
    }

    // 4. Excel keywords — ONLY unambiguous data-centric terms
    const excelKeywords = [
        'rows and columns', 'formula', 'chart', 'graph', 'pivot table',
        'budget tracker', 'expense tracker', 'financial model',
        'dataset', 'analytics sheet', 'metrics sheet', 'data entry form',
        'inventory sheet', 'timesheet', 'scorecard'
    ];
    if (excelKeywords.some(kw => lowerPrompt.includes(kw))) {
        return { type: 'excel', confidence: 0.9 };
    }

    // 5. Default to Word — safest fallback for text-heavy requests
    return { type: 'word', confidence: 0.5 };
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

/**
 * Detect advanced Word-specific operations required by the prompt.
 * Returns an array of operation codes (e.g. ['MULTI_AUTHOR_MERGE', 'NAVIGATION_STRUCTURE']).
 * Returns an empty array for simple prompts — zero cost to standard flows.
 */
const detectAdvancedOps = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();
    const detectedOps = [];

    for (const [opCode, keywords] of Object.entries(ADVANCED_OPS_MAP)) {
        if (keywords.some(kw => lowerPrompt.includes(kw))) {
            detectedOps.push(opCode);
        }
    }

    return detectedOps; // e.g. ['MULTI_AUTHOR_MERGE', 'NAVIGATION_STRUCTURE']
};

module.exports = {
    classifyIntent,
    detectDocType,
    detectRisk,
    generateMetadata,
    cleanVoiceTranscript,
    detectAdvancedOps
};
