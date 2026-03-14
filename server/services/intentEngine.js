/**
 * Docs Agent Intent Engine (Invisible Intelligence Layer)
 * Handles deterministic, rule-based logic with confidence scoring.
 */

const INTENT_WEIGHTS = {
    CREATE: { keywords: ['create', 'make', 'generate', 'build', 'new', 'start', 'prepare', 'write', 'draft', 'compose', 'structure', 'arrange'], weight: 1.0 },
    MODIFY: { keywords: ['edit', 'change', 'update', 'fix', 'refine', 'revise', 'modify', 'calculate', 'sum', 'average', 'addition', 'math', 'total', 'arithmetic', 'correct', 'improve', 'enhance', 'add', 'include', 'insert', 'append', 'remove section', 'rename', 'replace', 'rewrite section', 'expand', 'shorten', 'make it', 'adjust'], weight: 0.9 },
    QUERY: { keywords: ['what', 'how', 'who', 'analyze', 'explain', 'search', 'tell me', 'find', 'lookup', 'research'], weight: 0.8 },
    ANALYZE: { keywords: ['analyze', 'summarize', 'extract', 'insights', 'points', 'statistics', 'key concepts', 'summary', 'report', 'detailed summary', 'short summary'], weight: 0.8 },
    COMPARE: { keywords: ['compare', 'similarities', 'differences', 'trends', 'relationships', 'versus', 'vs', 'contrast', 'comparison', 'cross-reference', 'side by side'], weight: 1.5 },
    DATA_OP: { keywords: ['merge', 'sort', 'filter', 'calculate', 'clean', 'duplicate', 'sum', 'average', 'tally'], weight: 1.0 },
    CONVERT: { keywords: ['turn into', 'convert', 'summarize to', 'transform', 'translate', 'export'], weight: 1.0 },
    DASHBOARD: { keywords: ['dashboard', 'kpi', 'monitor', 'report card', 'metrics', 'visualization', 'power bi', 'analytics board', 'trends', 'performance', 'stats', 'widgets', 'data board', 'insights board'], weight: 1.5 },
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
    VISUAL_GENERATION: [
        'generate image', 'create image', 'draw', 'picture of', 'show an image',
        'visualize as image', 'add a photo', 'insert image', 'generate a picture',
        'with an image', 'add image', 'include image', 'picture', 'photo', 'graphic'
    ],
    DATA_VISUALIZATION: [
        'graph', 'chart', 'plot', 'bar chart', 'pie chart', 'line graph',
        'visualize data', 'create a chart', 'draw a graph', 'show statistics'
    ],
    PREMIUM_DESIGN: [
        'premium', 'luxury', 'modern design', 'minimalist', 'vibrant', 'corporate',
        'creative', 'sleek', 'elegant', 'professional look', 'high-end', 'beautiful'
    ],
    ADVANCED_LAYOUTS: [
        'comparison', 'side by side', 'quadrant', 'swot', 'timeline', 'milestone',
        'big fact', 'metric highlight', 'title slide', 'cover slide'
    ],
};

/**
 * Detect document type with confidence.
 */
const detectDocType = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();

    // 1. Explicit file-type signals — highest priority
    const explicitMap = {
        word: ['word document', 'word file', 'docx', '.doc', 'word doc', 'annual report', 'company overview', 'policy document', 'standard operating procedure'],
        ppt: ['powerpoint', 'presentation', 'slide deck', 'pptx', ' ppt '],
        excel: ['excel', 'spreadsheet', 'xlsx', 'csv file', 'workbook'],
        dashboard: ['dashboard', 'power bi', 'analytics board', 'report card', 'kpi board', 'metrics', 'visualization', 'measure performance', 'track growth', 'business health', 'sales analytics', 'inventory monitor', 'logistics board', 'financial risk board', 'profitability board', 'performance metrics', 'power bi source', 'pbi model', 'dashboard source', 'analytical board'],
    };
    for (const [t, keywords] of Object.entries(explicitMap)) {
        if (keywords.some(kw => lowerPrompt.includes(kw))) {
            return { type: t, confidence: 1.0 };
        }
    }

    // 2. Word-specific structural keywords
    const wordKeywords = [
        'heading', 'paragraph', 'cover page', 'table of contents', 'toc',
        'page number', 'page numbering', 'header', 'footer', 'chapter', 'report',
        'proposal', 'memo', 'thesis', 'brief', 'news', 'article'
    ];
    if (wordKeywords.some(kw => lowerPrompt.includes(kw))) {
        return { type: 'word', confidence: 0.95 };
    }

    // 3. PPT keywords
    const pptKeywords = ['slide', 'deck', 'bullet point', 'keynote', 'present'];
    if (pptKeywords.some(kw => lowerPrompt.includes(kw))) {
        return { type: 'ppt', confidence: 0.9 };
    }

    // 4. Excel keywords
    const excelKeywords = [
        'formula', 'chart', 'graph', 'pivot table', 'budget', 'expense', 'revenue', 'financial', 'highlights', 'yearly performance'
    ];
    if (excelKeywords.some(kw => lowerPrompt.includes(kw))) {
        return { type: 'excel', confidence: 0.9 };
    }

    return { type: 'word', confidence: 0.4 };
};

/**
 * Detect requested content length/detail
 */
const detectLength = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();

    // Check for length modifiers specifically
    if (/\b(short|concise|brief|quick summary|minimal)\b/i.test(lowerPrompt)) return 'SHORT';
    if (/\b(detailed|elaborate|extensive|comprehensive|full|in-depth|deep dive)\b/i.test(lowerPrompt)) return 'DETAILED';

    // Default to MEDIUM if no explicit modifiers found
    return 'MEDIUM';
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
const generateMetadata = (prompt, overrideIntent = null, overrideCategory = null, overrideDocType = null) => {
    const lowerPrompt = prompt.toLowerCase();

    const { intent: baseIntent, confidence } = classifyIntent(prompt);
    const intent = overrideIntent || baseIntent;
    const { type: baseType } = detectDocType(prompt);
    const type = overrideDocType || baseType;

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

    // Determine Composition Profile (Golden Ratio vs Text-Heavy)
    let composition_profile = 'GOLDEN_RATIO'; // Default
    const textHeavyKeywords = ['legal', 'contract', 'agreement', 'terms', 'privacy', 'policy', 'memo', 'academic', 'thesis', 'sop', 'standard operating procedure', 'documentation', 'spec'];
    if (textHeavyKeywords.some(kw => lowerPrompt.includes(kw)) || category === 'Legal' || category === 'Education') {
        composition_profile = 'TEXT_HEAVY';
    }

    // Smart Naming
    const allIntentKeywords = Object.values(INTENT_WEIGHTS).flatMap(d => d.keywords);
    const docTypeKeywords = ['excel', 'sheet', 'spreadsheet', 'csv', 'word', 'doc', 'report', 'ppt', 'presentation', 'slide', 'powerpoint', 'table', 'data', 'document', 'file'];
    const stopWords = [...FILLER_WORDS, 'the', 'a', 'an', 'for', 'and', 'with', 'about', 'this', 'that', 'from', 'into', 'on', 'in', 'of', 'to', 'my', 'our', 'me', 'we', 'it'];
    const allFilterWords = new Set([...allIntentKeywords, ...docTypeKeywords, ...stopWords]);

    const words = prompt.split(/[\s,]+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length > 2 && !allFilterWords.has(w.toLowerCase()));

    let nameParts = words.length > 0 ? words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : [category !== 'General' ? category : 'Document'];

    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    nameParts.push(`${months[now.getMonth()]}${now.getDate()}`);

    const ext = type === 'ppt' ? '.pptx' : (type === 'excel' ? '.xlsx' : (type === 'dashboard' ? '.json' : '.docx'));

    return {
        name: `${nameParts.join('_')}${ext}`,
        category,
        purpose: `Hybrid ${category} execution`,
        entities: [],
        confidenceScore: confidence,
        composition_profile
    };
};

/**
 * Clean voice transcripts deterministically
 */
const cleanVoiceTranscript = (transcript) => {
    if (!transcript) return "";
    let cleaned = transcript.toLowerCase();
    FILLER_WORDS.forEach(word => {
        cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    });
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');
    const fluff = ['please', 'can you', 'could you', 'i want to', 'i would like to', 'if you can'];
    fluff.forEach(phrase => {
        cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '');
    });
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
};

/**
 * Detect advanced Word-specific operations
 */
const detectAdvancedOps = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();
    const detectedOps = [];
    for (const [opCode, keywords] of Object.entries(ADVANCED_OPS_MAP)) {
        if (keywords.some(kw => lowerPrompt.includes(kw))) {
            detectedOps.push(opCode);
        }
    }
    return detectedOps;
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
 * Context-aware intent classification.
 * When a document is already open and no strong CREATE signal found,
 * default to MODIFY instead of QUERY.
 * @param {string} prompt
 * @param {boolean} hasOpenDoc - true if a document is currently active in the editor
 */
const contextualClassifyIntent = (prompt, hasOpenDoc = false, selectedDocCount = 0) => {
    const result = classifyIntent(prompt);

    // Explicit CREATE signals should always override background context
    const strongCreateSignals = ['create', 'make', 'generate', 'build', 'new', 'start', 'prepare', 'draft', 'compose', 'ppt', 'powerpoint', 'excel', 'word', 'presentation'];
    const lowerPrompt = prompt.toLowerCase();
    const hasStrongCreate = strongCreateSignals.some(kw => lowerPrompt.includes(kw));

    if (hasStrongCreate) {
        return { intent: 'CREATE', confidence: 1.0 };
    }

    // If multiple documents are selected, strongly suggest COMPARE or ANALYZE
    // but only if NO strong CREATE signal is present
    if (selectedDocCount > 1 && !hasStrongCreate) {
        if (result.intent === 'MODIFY' || result.intent === 'CREATE' || result.intent === 'QUERY') {
            const compareSignals = INTENT_WEIGHTS.COMPARE.keywords.some(kw => prompt.toLowerCase().includes(kw));
            if (compareSignals) return { intent: 'COMPARE', confidence: 0.95 };
            return { intent: 'ANALYZE', confidence: 0.9 };
        }
    }

    // If a doc is open and there's no explicit "create new" signal, treat as MODIFY
    if (hasOpenDoc && !hasStrongCreate && result.intent !== 'QUERY') {
        return { ...result, intent: 'MODIFY', confidence: Math.max(result.confidence, 0.85) };
    }

    // If a doc is open and the intent is QUERY with no create signal, still assume MODIFY
    if (hasOpenDoc && !hasStrongCreate && result.intent === 'QUERY') {
        return { ...result, intent: 'MODIFY', confidence: 0.8 };
    }

    return result;
};

module.exports = {
    classifyIntent,
    contextualClassifyIntent,
    detectDocType,
    detectLength,
    detectRisk,
    generateMetadata,
    cleanVoiceTranscript,
    detectAdvancedOps
};

