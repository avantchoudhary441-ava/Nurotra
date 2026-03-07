/**
 * Document Analysis Service — Local NLP Engine
 * Performs comprehensive document analysis entirely in JavaScript
 * without any external API calls. Works even when Gemini quota is exhausted.
 */

const { parseDocument, parsePDF, parseDOCX, parseText } = require('../utils/documentParser');
const Document = require('../models/Document');
const ExcelJS = require('exceljs');
const { spawn } = require('child_process');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// PYTHON ANALYSIS ENGINE INTERFACE
// ─────────────────────────────────────────────────────────────
const callPythonAnalysisEngine = async (documents, prompt, analysisType) => {
    return new Promise((resolve, reject) => {
        const pythonPath = 'python'; // or full path if needed
        const scriptPath = path.join(__dirname, 'python', 'analysis_orchestrator.py');

        const payload = JSON.stringify({ documents, prompt, analysisType });

        const pyProcess = spawn(pythonPath, [scriptPath]);

        let output = '';
        let errorOutput = '';

        pyProcess.stdin.write(payload);
        pyProcess.stdin.end();

        pyProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pyProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pyProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('[PythonAnalysis] Error code:', code, errorOutput);
                return reject(new Error(`Python process failed with code ${code}: ${errorOutput}`));
            }
            try {
                const result = JSON.parse(output);
                resolve(result);
            } catch (err) {
                console.error('[PythonAnalysis] JSON Parse Error:', err.message, output.substring(0, 500));
                reject(new Error('Failed to parse Python analysis output'));
            }
        });
    });
};

// ─────────────────────────────────────────────────────────────
// ANALYSIS INTENT DETECTOR  (rule-based, no API)
// ─────────────────────────────────────────────────────────────
const detectAnalysisIntent = async (prompt, docCount) => {
    const p = prompt.toLowerCase();

    const isCreate = /\b(create|write|generate|draft|make a new|compose|build|draw|use|read|from)\b/.test(p);
    const isQuestion = /\b(what|how|who|where|why|search|lookup|research|explain)\b/.test(p);
    const isEdit = /\b(edit|change|update|fix|modify|add|remove|shorten|expand|adjust|refine)\b/.test(p);
    const isAnalyze = /\b(analyze|summarize|insight|point|trend|extract|summary|report|compare|versus|vs|contrast)\b/.test(p);

    // If there's an explicit "Create" command even with files, it's NOT a document analysis request.
    // It's a "File as input/instruction" request.
    if (isCreate && !isAnalyze) {
        return { isAnalysisRequest: false };
    }

    if (docCount === 0) {
        return { isAnalysisRequest: false };
    }

    let analysisType = 'DEFAULT';
    const modules = ['summarization', 'keyword_extraction', 'entity_recognition', 'topic_detection', 'insight_generation'];

    if (/\b(compare|comparison|versus|vs|contrast|diff|differ)\b/.test(p)) {
        analysisType = 'COMPARE';
        modules.push('comparison');
    } else if (/\b(risk|compliance|sensitive|danger|problem|issue|concern)\b/.test(p)) {
        analysisType = 'RISK';
        modules.push('risk_detection');
    } else if (/\b(extract|pull out|find all|list all|get data|structured)\b/.test(p)) {
        analysisType = 'EXTRACT_INFO';
        modules.push('information_extraction');
    } else if (/\b(sentiment|tone|mood|feel|positive|negative)\b/.test(p)) {
        analysisType = 'SENTIMENT';
        modules.push('sentiment_analysis');
    } else if (/\b(who|people|names|entities|organizations|mentioned)\b/.test(p)) {
        analysisType = 'ENTITY';
    } else if (/\b(summari|overview|highlight|key point|main point|brief|about)\b/.test(p)) {
        analysisType = 'SUMMARIZE';
    } else if (/\b(insight|finding|discover|recommend|conclusion|takeaway)\b/.test(p)) {
        analysisType = 'INSIGHTS';
    }

    return {
        isAnalysisRequest: true,
        analysisType,
        modules: [...new Set(modules)],
        clarificationNeeded: false,
        clarificationMessage: null
    };
};

// ─────────────────────────────────────────────────────────────
// DOCUMENT CONTENT BUILDER
// ─────────────────────────────────────────────────────────────
const buildDocumentSet = async (selectedDocIds = [], uploadedFiles = []) => {
    const docs = [];

    // A. Sidebar-selected documents from MongoDB
    if (selectedDocIds.length > 0) {
        try {
            const dbDocs = await Document.find({ _id: { $in: selectedDocIds } });
            for (const doc of dbDocs) {
                docs.push({
                    name: doc.name,
                    content: doc.content || '',
                    type: doc.type || 'word',
                    source: 'sidebar',
                    id: String(doc._id)
                });
            }
        } catch (e) {
            console.error('[DocumentAnalysis] Error fetching sidebar docs:', e.message);
        }
    }

    // B. Uploaded files
    for (const file of uploadedFiles) {
        let text = '';
        try {
            const mime = file.mimetype || '';
            const name = (file.originalname || '').toLowerCase();

            if (mime.includes('pdf') || name.endsWith('.pdf')) {
                text = await parsePDF(file.buffer);
            } else if (mime.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')) {
                text = await parseDOCX(file.buffer);
            } else if (mime.includes('sheet') || mime.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
                try {
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(file.buffer);
                    const lines = [];
                    workbook.eachSheet(sheet => {
                        lines.push(`[Sheet: ${sheet.name}]`);
                        sheet.eachRow(row => {
                            const vals = row.values
                                .filter(v => v !== null && v !== undefined)
                                .map(v => (typeof v === 'object' && v.text ? v.text : String(v)));
                            if (vals.length) lines.push(vals.join(' | '));
                        });
                    });
                    text = lines.join('\n');
                } catch (xlsErr) {
                    text = file.buffer.toString('utf8');
                }
            } else if (name.endsWith('.csv')) {
                text = file.buffer.toString('utf8');
            } else {
                text = await parseText(file.buffer);
            }
        } catch (e) {
            console.error('[DocumentAnalysis] Parse error:', file.originalname, e.message);
        }
        docs.push({
            name: file.originalname || 'Uploaded File',
            content: text || `[Could not extract: ${file.originalname}]`,
            type: 'upload',
            source: 'upload'
        });
    }

    return docs;
};

// ─────────────────────────────────────────────────────────────
// LOCAL NLP HELPERS
// ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
    'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she', 'they', 'we', 'you', 'i',
    'not', 'no', 'as', 'if', 'so', 'yet', 'up', 'into', 'than', 'then', 'when', 'where',
    'how', 'what', 'which', 'who', 'whom', 'also', 'about', 'above', 'after', 'before',
    'between', 'during', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only',
    'both', 'all', 'any', 'every', 'much', 'many', 'very', 'just', 'out', 'there', 'here',
    'their', 'them', 'my', 'our', 'your', 'his', 'her', 'its', 'over', 'under', 'again', 'further'
]);

/** Tokenize text into words */
const tokenize = (text) => text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

/** Top N frequent words */
const topWords = (tokens, n = 15) => {
    const freq = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([word, count]) => ({ word, count }));
};

/** Extract noun-phrase-like bigrams */
const extractBigrams = (text, n = 10) => {
    const words = text.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const freq = {};
    for (let i = 0; i < words.length - 1; i++) {
        if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
            const bg = `${words[i]} ${words[i + 1]}`;
            freq[bg] = (freq[bg] || 0) + 1;
        }
    }
    return Object.entries(freq)
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([phrase]) => phrase);
};

/** Extract sentences that seem "important" */
const extractKeySentences = (text, n = 6) => {
    const sentences = text.match(/[A-Z][^.!?]*[.!?]/g) || [];
    const scored = sentences.map(s => {
        let score = 0;
        const sl = s.toLowerCase();
        if (/\b(key|important|significant|crucial|main|primary|result|finding|conclusion|recommend|highlight)\b/.test(sl)) score += 3;
        if (/\d+(\.\d+)?%/.test(s)) score += 2; // has percentages
        if (/\$[\d,.]+|\b\d{4,}\b/.test(s)) score += 2; // has numbers
        if (s.length > 60 && s.length < 250) score += 1;
        return { s, score };
    });
    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, n)
        .map(x => x.s.trim());
};

/** Named entity patterns */
const extractNamedEntities = (text) => {
    const people = [];
    const organizations = [];
    const locations = [];
    const dates = [];
    const financials = [];
    const technologies = [];

    // People: Title + Capitalized Name
    const peopleMatches = text.match(/\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+(?: [A-Z][a-z]+)*/g) || [];
    const capsNames = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
    [...new Set([...peopleMatches, ...capsNames.slice(0, 8)])].slice(0, 10).forEach(p => people.push(p));

    // Organizations: Ends with Inc|Ltd|Corp|LLC|Group|Company|Institute|University
    const orgMatches = text.match(/\b[A-Z][A-Za-z &'-]+(?:Inc|Ltd|Corp|LLC|Group|Company|Institute|University|Agency|Bureau|Department|Foundation|Association|Committee|Council|Authority)\b/g) || [];
    [...new Set(orgMatches)].slice(0, 8).forEach(o => organizations.push(o));

    // Locations: Country/City-like patterns (capitalized followed by contextual words)
    const locMatches = text.match(/\b[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*\b/g) || [];
    const knownGeo = ['India', 'China', 'USA', 'Europe', 'Africa', 'Asia', 'America', 'Germany', 'Japan', 'France', 'UK', 'Canada', 'Australia', 'Brazil', 'Russia', 'Dubai', 'London', 'New York', 'California', 'Tesla', 'BYD'];
    locMatches.filter(l => knownGeo.some(g => l.includes(g))).slice(0, 8).forEach(l => locations.push(l));

    // Dates
    const dateMatches = text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s*\d{4}\b|\b\d{4}\b/g) || [];
    [...new Set(dateMatches)].slice(0, 8).forEach(d => dates.push(d));

    // Financials: $X or X billion/million
    const finMatches = text.match(/\$[\d,.]+(?: million| billion| trillion)?\b|\d+(?:\.\d+)?(?:\s*(?:million|billion|trillion))?\s*(?:USD|EUR|GBP)/gi) || [];
    [...new Set(finMatches)].slice(0, 8).forEach(f => financials.push(f));

    // Technologies
    const techWords = ['AI', 'ML', 'EV', 'IoT', 'blockchain', 'cloud', 'API', 'neural', 'deep learning', 'machine learning', 'battery', 'lithium', 'solar', 'renewable', 'electric', 'autonomous', 'Python', 'JavaScript', 'React', 'Node', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes'];
    const textLower = text.toLowerCase();
    techWords.filter(t => textLower.includes(t.toLowerCase())).forEach(t => technologies.push(t));

    return {
        people: [...new Set(people)].slice(0, 8),
        organizations: [...new Set(organizations)].slice(0, 8),
        locations: [...new Set(locations)].slice(0, 6),
        dates: [...new Set(dates)].slice(0, 6),
        financialValues: [...new Set(financials)].slice(0, 6),
        technologies: [...new Set(technologies)].slice(0, 8)
    };
};

/** Sentiment analysis (lexicon-based) */
const analyzeSentiment = (text) => {
    const positive = ['good', 'great', 'excellent', 'positive', 'success', 'growth', 'increase', 'improve', 'benefit', 'opportunity', 'strong', 'effective', 'efficient', 'innovative', 'significant', 'leading', 'advanced', 'high', 'best', 'profit', 'gain', 'rise', 'boost', 'enhance', 'remarkable'];
    const negative = ['bad', 'poor', 'negative', 'fail', 'decline', 'decrease', 'loss', 'risk', 'problem', 'issue', 'concern', 'challenge', 'difficult', 'threat', 'weak', 'drop', 'low', 'worse', 'critical', 'shortage', 'deficit', 'damage', 'volatile', 'unstable'];

    const words = text.toLowerCase().split(/\s+/);
    let pos = 0, neg = 0;
    words.forEach(w => {
        if (positive.some(p => w.includes(p))) pos++;
        if (negative.some(n => w.includes(n))) neg++;
    });
    const total = pos + neg || 1;
    const score = Math.round((pos / total) * 100);

    let overall = 'Neutral';
    if (score > 65) overall = 'Positive';
    else if (score < 35) overall = 'Negative';
    else if (pos > 0 && neg > 0) overall = 'Mixed';

    // Detect tone
    const hasStats = /\d+%|\d+\.\d+/.test(text);
    const hasTechnical = /algorithm|function|module|database|protocol|specification/.test(text.toLowerCase());
    const hasBusiness = /revenue|profit|market|customer|strategy|fiscal|quarter/.test(text.toLowerCase());
    let tone = 'Neutral';
    if (hasTechnical) tone = 'Technical';
    else if (hasBusiness) tone = 'Professional';
    else if (hasStats) tone = 'Analytical';

    return {
        overall,
        score,
        tone,
        breakdown: {
            positive: Math.round((pos / total) * 100),
            neutral: Math.max(0, 100 - Math.round((pos / total) * 100) - Math.round((neg / total) * 100)),
            negative: Math.round((neg / total) * 100)
        }
    };
};

/** Classify document type */
const classifyDocument = (name, content) => {
    const c = content.toLowerCase();
    const n = name.toLowerCase();
    if (/invoice|billing|payment|amount due/.test(c) || /invoice/.test(n)) return 'Invoice';
    if (/contract|agreement|parties|obligation|whereas/.test(c) || /contract|agreement/.test(n)) return 'Legal Contract';
    if (/research|abstract|methodology|hypothesis|conclusion|journal/.test(c)) return 'Research Paper';
    if (/resume|curriculum vitae|cv|experience|education|skills/.test(c) || /resume|cv/.test(n)) return 'Resume / CV';
    if (/market|revenue|forecast|quarter|fiscal|growth|segment/.test(c) || /market|report/.test(n)) return 'Market Analysis Report';
    if (/balance sheet|income statement|cash flow|assets|liabilities/.test(c)) return 'Financial Statement';
    if (/policy|procedure|guideline|compliance|regulation|standard/.test(c)) return 'Policy / Compliance Document';
    if (/chapter|section|introduction|table of contents|bibliography/.test(c)) return 'Academic / Book Content';
    if (/meeting|agenda|minutes|attendees|action items/.test(c)) return 'Meeting Notes';
    if (/product|feature|specification|requirement|user story/.test(c)) return 'Product Specification';
    if (/data|dataset|row|column|sheet|csv/.test(n) || /xlsx|xls|csv/.test(n)) return 'Data / Spreadsheet';
    return 'General Document';
};

/** Extract topic clusters based on high-frequency domain words */
const detectTopics = (text) => {
    const domains = {
        'Electric Vehicles': ['ev', 'electric vehicle', 'battery', 'charging', 'bev', 'phev', 'range', 'tesla', 'byd'],
        'Market Analysis': ['market', 'revenue', 'growth', 'forecast', 'segment', 'share', 'competition', 'demand'],
        'Technology': ['ai', 'machine learning', 'software', 'algorithm', 'cloud', 'data', 'digital', 'automation'],
        'Finance': ['profit', 'loss', 'revenue', 'cost', 'budget', 'investment', 'roi', 'cash flow'],
        'Sustainability': ['sustainability', 'emission', 'carbon', 'green', 'renewable', 'eco', 'climate'],
        'Supply Chain': ['supply', 'chain', 'logistics', 'inventory', 'procurement', 'vendor', 'delivery'],
        'Healthcare': ['patient', 'clinical', 'medical', 'health', 'treatment', 'diagnosis', 'hospital'],
        'Legal': ['contract', 'agreement', 'clause', 'party', 'obligation', 'liability', 'jurisdiction'],
        'HR / People': ['employee', 'hiring', 'performance', 'talent', 'team', 'workforce', 'culture'],
        'Research': ['study', 'analysis', 'methodology', 'result', 'hypothesis', 'experiment', 'findings']
    };

    const tl = text.toLowerCase();
    const detected = [];
    for (const [topic, keywords] of Object.entries(domains)) {
        const matches = keywords.filter(k => tl.includes(k));
        if (matches.length >= 2) detected.push({ topic, matches: matches.length });
    }
    return detected.sort((a, b) => b.matches - a.matches).map(d => d.topic);
};

/** Detect risks */
const detectRisks = (text) => {
    const patterns = [
        { regex: /\b(?:security breach|data leak|unauthorized access|cyber|vulnerability)\b/gi, severity: 'High', category: 'Cybersecurity Risk' },
        { regex: /\b(?:shortage|supply chain disruption|bottleneck|delay)\b/gi, severity: 'High', category: 'Supply Chain Risk' },
        { regex: /\b(?:regulatory|compliance|legal|lawsuit|penalty|fine)\b/gi, severity: 'High', category: 'Regulatory/Legal Risk' },
        { regex: /\b(?:competition|competitive|market share loss|substitute)\b/gi, severity: 'Medium', category: 'Competitive Risk' },
        { regex: /\b(?:inflation|currency|exchange rate|economic downturn|recession)\b/gi, severity: 'Medium', category: 'Financial/Economic Risk' },
        { regex: /\b(?:dependency|single source|vendor lock)\b/gi, severity: 'Medium', category: 'Dependency Risk' },
        { regex: /\b(?:outdated|legacy|technical debt|deprecated)\b/gi, severity: 'Low', category: 'Technical Risk' },
        { regex: /\b(?:turnover|attrition|talent gap|skill shortage)\b/gi, severity: 'Low', category: 'HR Risk' }
    ];

    const risks = [];
    const tl = text.toLowerCase();
    for (const { regex, severity, category } of patterns) {
        const matches = text.match(regex);
        if (matches) {
            const context = matches.slice(0, 2).join(', ');
            risks.push({ risk: category, severity, location: `Mentions: "${context}"` });
        }
    }
    return risks;
};

// ─────────────────────────────────────────────────────────────
// CORE LOCAL ANALYSIS ENGINE
// ─────────────────────────────────────────────────────────────
const runAnalysisModules = async (docs, modules, analysisType, userPrompt) => {
    const allText = docs.map(d => d.content || '').join(' ');
    const isMultiDoc = docs.length > 1;

    console.log('[LocalAnalysis] Analyzing', docs.length, 'docs, total chars:', allText.length);

    // ── 1. Tokenize & Keywords
    const tokens = tokenize(allText);
    const topKW = topWords(tokens, 20);
    const bigrams = extractBigrams(allText, 10);

    // ── 2. Key Sentences for Summary
    const keySentences = extractKeySentences(allText, 6);

    // ── 3. Topics
    const topics = detectTopics(allText);

    // ── 4. Entities
    const entities = extractNamedEntities(allText);

    // ── 5. Sentiment
    const sentimentData = analyzeSentiment(allText);

    // ── 6. Document Classification
    const docOverview = docs.map(d => ({
        name: d.name,
        classification: classifyDocument(d.name, d.content || ''),
        purpose: `Contains ${Math.round((d.content || '').length / 5)} words of ${classifyDocument(d.name, d.content || '').toLowerCase()} content`,
        estimatedLength: (d.content || '').length > 5000 ? 'Long (~10+ pages)' : (d.content || '').length > 1500 ? 'Medium (~3-5 pages)' : 'Short (~1-2 pages)',
        language: 'English'
    }));

    // ── 7. Risks
    const risks = detectRisks(allText);

    // ── 8. Insights
    const insights = [];
    if (topKW.length > 0) {
        insights.push({
            type: 'Key Insight',
            insight: `The most prominent theme is "${topKW[0].word}" appearing ${topKW[0].count} times, suggesting this is a central focus of the document(s).`,
            importance: 'High'
        });
    }
    if (topics.length > 0) {
        insights.push({
            type: 'Topic Insight',
            insight: `Primary domain identified: ${topics[0]}. ${topics.length > 1 ? `Also covers: ${topics.slice(1, 3).join(', ')}.` : ''}`,
            importance: 'High'
        });
    }
    if (entities.financialValues.length > 0) {
        insights.push({
            type: 'Financial Insight',
            insight: `Key financial figures mentioned: ${entities.financialValues.slice(0, 3).join(', ')}`,
            importance: 'High'
        });
    }
    if (sentimentData.overall !== 'Neutral') {
        insights.push({
            type: 'Sentiment Insight',
            insight: `Document has a ${sentimentData.overall.toLowerCase()} tone (${sentimentData.score}/100 score), written in a ${sentimentData.tone.toLowerCase()} style.`,
            importance: 'Medium'
        });
    }
    if (risks.length > 0) {
        insights.push({
            type: 'Risk Flag',
            insight: `Detected ${risks.filter(r => r.severity === 'High').length} high-severity and ${risks.filter(r => r.severity === 'Medium').length} medium-severity risk indicators.`,
            importance: risks.some(r => r.severity === 'High') ? 'High' : 'Medium'
        });
    }
    if (keySentences.length > 0) {
        insights.push({
            type: 'Key Takeaway',
            insight: keySentences[0],
            importance: 'Medium'
        });
    }

    // ── 9. Comparative (multi-doc)
    let comparativeAnalysis = null;
    if (isMultiDoc) {
        const docTokenSets = docs.map(d => new Set(tokenize(d.content || '')));
        const [setA, setB] = docTokenSets;
        const intersection = setB ? [...setA].filter(w => setB.has(w)) : [];
        const onlyA = setB ? [...setA].filter(w => !setB.has(w)) : [];
        const onlyB = setB ? [...setB].filter(w => !setA.has(w)) : [];

        comparativeAnalysis = {
            similarities: [
                `Both documents share ${intersection.length} common terms`,
                ...(intersection.slice(0, 3).map(w => `Common topic: "${w}"`))
            ],
            differences: [
                `"${docs[0].name}" uniquely focuses on: ${onlyA.slice(0, 4).join(', ')}`,
                docs[1] ? `"${docs[1].name}" uniquely focuses on: ${onlyB.slice(0, 4).join(', ')}` : ''
            ].filter(Boolean),
            contradictions: [],
            commonEntities: intersection.slice(0, 5)
        };
    }

    // ── 10. Information Extraction
    const structuredData = [];
    const wordCount = allText.split(/\s+/).length;
    structuredData.push({ field: 'Total Word Count', value: wordCount.toLocaleString(), confidence: 'High' });
    structuredData.push({ field: 'Document Type', value: docOverview[0]?.classification || 'Unknown', confidence: 'High' });
    structuredData.push({ field: 'Primary Language', value: 'English', confidence: 'High' });
    if (entities.dates.length > 0) {
        structuredData.push({ field: 'Date References', value: entities.dates.slice(0, 3).join(', '), confidence: 'Medium' });
    }
    if (entities.financialValues.length > 0) {
        structuredData.push({ field: 'Key Financial Figures', value: entities.financialValues.slice(0, 3).join(', '), confidence: 'Medium' });
    }

    // ── 11. Executive Summary
    const docNames = docs.map(d => d.name).join(' and ');
    const topicStr = topics.slice(0, 3).join(', ') || 'general';
    const summaryShort = isMultiDoc
        ? `This analysis covers ${docs.length} documents: ${docNames}. The primary topics include ${topicStr}. Overall tone is ${sentimentData.overall.toLowerCase()}.`
        : `"${docs[0].name}" is a ${docOverview[0]?.classification || 'document'} primarily covering ${topicStr}. ${keySentences[0] || ''}`.substring(0, 300);

    const summaryDetailed = [
        `Analyzed ${docs.length} document(s) with a combined ${wordCount.toLocaleString()} words`,
        `Primary topics: ${topics.slice(0, 3).join(', ') || 'General content'}`,
        `Overall sentiment: ${sentimentData.overall} (${sentimentData.score}/100) with a ${sentimentData.tone} tone`,
        `Key entities detected: ${[...entities.people.slice(0, 2), ...entities.organizations.slice(0, 2)].join(', ') || 'None identified'}`,
        `${risks.length} risk indicators found (${risks.filter(r => r.severity === 'High').length} high, ${risks.filter(r => r.severity === 'Medium').length} medium)`,
        keySentences[1] || `Top keywords: ${topKW.slice(0, 5).map(k => k.word).join(', ')}`
    ];

    const result = {
        executiveSummary: {
            short: summaryShort,
            detailed: summaryDetailed
        },
        documentOverview: docOverview,
        topicsAndThemes: {
            mainTopics: topics.slice(0, 5),
            subThemes: bigrams.slice(0, 6),
            keyFindings: keySentences.slice(0, 4)
        },
        keywords: {
            primary: topKW.slice(0, 8).map(k => k.word),
            secondary: topKW.slice(8, 15).map(k => k.word),
            keyPhrases: bigrams.slice(0, 8)
        },
        entities,
        sentimentAnalysis: sentimentData,
        informationExtraction: { structuredData },
        riskAndCompliance: { risks, complianceIssues: [], sensitiveData: [] },
        insights,
        patterns: {
            recurringKeywords: topKW.slice(0, 6).map(k => `${k.word} (${k.count}x)`),
            recurringThemes: topics.slice(0, 4),
            anomalies: []
        },
        metadata: docOverview.map(d => ({
            docName: d.name,
            detectedType: d.classification,
            estimatedLength: d.estimatedLength,
            language: d.language
        }))
    };

    if (isMultiDoc && comparativeAnalysis) {
        result.comparativeAnalysis = comparativeAnalysis;
    }

    console.log('[LocalAnalysis] Complete. Topics:', topics.length, '| KW:', topKW.length, '| Entities people:', entities.people.length, '| Risks:', risks.length);
    return result;
};

// ─────────────────────────────────────────────────────────────
// WORD REPORT GENERATOR
// ─────────────────────────────────────────────────────────────
const generateAnalysisWordReport = async (analysisResult, docs, analysisType) => {
    const { Document: WordDoc, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx');

    const isMultiDoc = docs.length > 1;
    const docName = isMultiDoc
        ? (analysisType === 'COMPARE' ? 'Document_Comparison_Report' : 'Multi_Document_Analysis_Report')
        : 'Document_Analysis_Report';

    const makeHeading = (text, level = HeadingLevel.HEADING_1) =>
        new Paragraph({ text, heading: level, spacing: { before: 300, after: 150 } });
    const makePara = (text, bold = false) =>
        new Paragraph({ children: [new TextRun({ text: text || '', bold, size: 22 })], spacing: { after: 100 } });
    const makeBullet = (text) =>
        new Paragraph({ text: text || '', bullet: { level: 0 }, spacing: { after: 60 } });
    const makeDivider = () =>
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '3B82F6' } }, spacing: { before: 200, after: 200 } });

    const children = [];

    children.push(new Paragraph({
        children: [new TextRun({ text: docName.replace(/_/g, ' '), bold: true, size: 56, color: '1D4ED8' })],
        alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 }
    }));
    children.push(new Paragraph({
        children: [new TextRun({ text: `Generated by Nurotra Intelligence Analyst · ${new Date().toLocaleDateString()}`, size: 20, color: '6B7280' })],
        alignment: AlignmentType.CENTER, spacing: { after: 400 }
    }));
    children.push(makeDivider());

    children.push(makeHeading('1. Document Overview'));
    docs.forEach((d, i) => children.push(makePara(`${i + 1}. ${d.name} (${d.source === 'sidebar' ? 'Workspace' : 'Uploaded'})`)));
    children.push(makeDivider());

    if (analysisResult.executiveSummary) {
        children.push(makeHeading('2. Executive Summary'));
        children.push(makePara(analysisResult.executiveSummary.short));
        (analysisResult.executiveSummary.detailed || []).forEach(b => children.push(makeBullet(b)));
        children.push(makeDivider());
    }

    if (analysisResult.topicsAndThemes?.mainTopics?.length) {
        children.push(makeHeading('3. Topics & Themes'));
        children.push(makePara('Main Topics', true));
        analysisResult.topicsAndThemes.mainTopics.forEach(t => children.push(makeBullet(t)));
        children.push(makePara('Key Findings', true));
        (analysisResult.topicsAndThemes.keyFindings || []).forEach(f => children.push(makeBullet(f)));
        children.push(makeDivider());
    }

    if (analysisResult.keywords?.primary?.length) {
        children.push(makeHeading('4. Keyword Analysis'));
        children.push(makePara('Keywords: ' + analysisResult.keywords.primary.join(', ')));
        children.push(makePara('Key Phrases: ' + (analysisResult.keywords.keyPhrases || []).join(', ')));
        children.push(makeDivider());
    }

    if (analysisResult.entities) {
        children.push(makeHeading('5. Entity Extraction (NER)'));
        const e = analysisResult.entities;
        if (e.people?.length) { children.push(makePara('People', true)); e.people.forEach(p => children.push(makeBullet(p))); }
        if (e.organizations?.length) { children.push(makePara('Organizations', true)); e.organizations.forEach(o => children.push(makeBullet(o))); }
        if (e.financialValues?.length) { children.push(makePara('Financial Figures', true)); e.financialValues.forEach(f => children.push(makeBullet(f))); }
        if (e.technologies?.length) { children.push(makePara('Technologies', true)); e.technologies.forEach(t => children.push(makeBullet(t))); }
        children.push(makeDivider());
    }

    if (analysisResult.sentimentAnalysis) {
        children.push(makeHeading('6. Sentiment & Tone'));
        const s = analysisResult.sentimentAnalysis;
        children.push(makePara(`Overall: ${s.overall} (${s.score}/100) · Tone: ${s.tone}`));
        children.push(makeDivider());
    }

    if (analysisResult.riskAndCompliance?.risks?.length) {
        children.push(makeHeading('7. Risk Assessment'));
        analysisResult.riskAndCompliance.risks.forEach(r =>
            children.push(makePara(`[${r.severity}] ${r.risk} — ${r.location}`))
        );
        children.push(makeDivider());
    }

    if (analysisResult.insights?.length) {
        children.push(makeHeading('8. Key Insights'));
        analysisResult.insights.forEach(ins =>
            children.push(makePara(`[${ins.importance}] ${ins.type}: ${ins.insight}`))
        );
        children.push(makeDivider());
    }

    if (isMultiDoc && analysisResult.comparativeAnalysis) {
        children.push(makeHeading('9. Comparative Analysis'));
        const ca = analysisResult.comparativeAnalysis;
        if (ca.similarities?.length) { children.push(makePara('Similarities', true)); ca.similarities.forEach(s => children.push(makeBullet(s))); }
        if (ca.differences?.length) { children.push(makePara('Differences', true)); ca.differences.forEach(d => children.push(makeBullet(d))); }
    }

    if (analysisResult.pythonInsights?.length) {
        children.push(makeHeading(isMultiDoc ? '10. Automated Data Insights' : '9. Automated Data Insights'));
        analysisResult.pythonInsights.forEach(ds => {
            children.push(makePara(`Dataset: ${ds.docName}`, true));
            if (ds.insights.summary) children.push(makeBullet(ds.insights.summary));
            (ds.insights.trends || []).forEach(t => children.push(makeBullet(t)));
            (ds.insights.anomalies || []).forEach(a => children.push(makeBullet(a)));
            (ds.insights.dominant_insights || []).forEach(d => children.push(makeBullet(d)));
        });
    }

    children.push(new Paragraph({
        children: [new TextRun({ text: 'Generated by Nurotra Docs Agent — Powered by Local Intelligence Engine', size: 18, color: '9CA3AF', italics: true })],
        alignment: AlignmentType.CENTER, spacing: { before: 400 }
    }));

    const doc = new WordDoc({ sections: [{ properties: {}, children }] });
    const buffer = await Packer.toBuffer(doc);
    return { buffer, name: `${docName}.docx` };
};

// ─────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
const runDocumentAnalysis = async (prompt, selectedDocIds = [], uploadedFiles = [], user, projectId = null) => {
    const totalDocCount = selectedDocIds.length + uploadedFiles.length;
    console.log('[DocumentAnalysis] Starting analysis. Docs:', totalDocCount, '| Prompt:', prompt.substring(0, 80));

    // Step 1: Detect intent (local, no API)
    const intentResult = await detectAnalysisIntent(prompt, totalDocCount);
    console.log('[DocumentAnalysis] Intent:', intentResult.analysisType, '| isAnalysis:', intentResult.isAnalysisRequest);

    if (!intentResult.isAnalysisRequest) {
        return { isAnalysisRequest: false };
    }

    // Step 2: Build document set
    const docs = await buildDocumentSet(selectedDocIds, uploadedFiles);
    console.log('[DocumentAnalysis] Document set built. Docs with content:', docs.filter(d => d.content.length > 50).length, '/', docs.length);

    if (docs.length === 0) {
        return {
            isAnalysisRequest: true,
            clarificationNeeded: true,
            clarificationMessage: 'No document content could be extracted. Please ensure the selected files contain readable text.'
        };
    }

    // --- NEW: Multi-Stage Python Pipeline ---
    let structuredInsights = null;
    try {
        console.log('[DocumentAnalysis] Running Python Analysis Engine...');
        structuredInsights = await callPythonAnalysisEngine(docs, prompt, intentResult.analysisType);
        console.log('[DocumentAnalysis] Python Engine processing complete. Chunks:', structuredInsights.chunks_count);
    } catch (pyErr) {
        console.warn('[DocumentAnalysis] Python Engine failed, continuing with limited context:', pyErr.message);
    }

    // --- LLM SHIFT: LLM-Based Analysis (Primary Engine) ---
    let analysisResult;
    let engineUsed = 'local-nlp';
    try {
        console.log('[LLM Shift] Attempting high-quality analysis via Gemini...');

        // Prepare professional context for LLM
        const datasetContext = structuredInsights?.dataset_insights?.map(d =>
            `DATASET [${d.docName}]: ${JSON.stringify(d.insights)}`
        ).join('\n') || 'None';

        const entityContext = JSON.stringify(structuredInsights?.aggregated_entities || {});

        const systemPrompt = `You are a professional market intelligence analyst and senior document auditor at Nurotra Intelligence.

Your objective is to generate a comprehensive, strategic analysis report based on structured insights extracted from documents.

PROMPT CONTEXT:
${prompt}

STRUCTURED INSIGHTS PROVIDED:
1. ENTITIES: ${entityContext}
2. DATASET STATISTICS/TRENDS: ${datasetContext}
3. DOCUMENT STRUCTURE: ${structuredInsights?.processed_docs?.map(d => `${d.name} (${d.chunks} chunks)`).join(', ')}

Your response MUST be a valid JSON object matching the detailed Nurotra analysis schema. 
Focus on:
- Executive Summary (Strategic highlights)
- Key Topics (What matters most)
- Entity Relationships (How people/orgs interact)
- Quantitative Insights (Statistics and trends detected in data)
- Risks & Challenges (Identify bottlenecks or threats)
- Strategic Takeaways

Respond ONLY with the JSON object.`;

        const userPromptSnippet = `Please analyze these documents and provide deep insights.\n\nRaw Text Sample:\n${docs.map(d => d.content).join('\n').substring(0, 15000)}`;

        const aiService = require('./aiService');
        const rawLLMResult = await aiService.generateWithFallback(userPromptSnippet, systemPrompt);

        // Clean and parse JSON
        let cleanLLMJson = rawLLMResult.replace(/```json/gi, "").replace(/```/g, "").trim();
        const start = cleanLLMJson.indexOf('{');
        const end = cleanLLMJson.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            cleanLLMJson = cleanLLMJson.substring(start, end + 1);
        }

        analysisResult = JSON.parse(cleanLLMJson);

        // Merge structured data from Python into LLM result if missing
        if (structuredInsights) {
            analysisResult.entities = analysisResult.entities || structuredInsights.aggregated_entities;
            analysisResult.pythonInsights = structuredInsights.dataset_insights;
        }

        engineUsed = 'llm-gemini';
        console.log('[LLM Shift] LLM analysis successful.');
    } catch (llmErr) {
        console.warn('[LLM Shift] LLM analysis failed, falling back to Local NLP:', llmErr.message);
        // Fallback to the original local module if Gemini or Python+Gemini fails
        analysisResult = await runAnalysisModules(docs, intentResult.modules, intentResult.analysisType, prompt);
    }

    // Finalize report data
    if (structuredInsights && analysisResult) {
        analysisResult.metadata = docs.map(d => ({
            name: d.name,
            chunks: (structuredInsights.processed_docs || []).find(pd => pd.name === d.name)?.chunks || 0
        }));
    }


    // Step 4: Generate Word report
    const { buffer, name: reportName } = await generateAnalysisWordReport(analysisResult, docs, intentResult.analysisType);

    // Step 5: Save report as a new Document record & WorkspaceFile
    let savedDoc = null;
    try {
        const newDoc = await Document.create({
            name: reportName.replace('.docx', ''),
            content: `[Analysis Report] ${reportName} — Generated by Nurotra Intelligence Layer`,
            type: 'word',
            userId: user._id,
            projectId: projectId || null,
            description: `Automated analysis of: ${docs.map(d => d.name).join(', ')}`,
            keywords: ['analysis', 'report', 'generated'],
            status: 'final'
        });
        savedDoc = { id: String(newDoc._id), name: newDoc.name, projectId: newDoc.projectId };

        // --- Persistence Shift: Save binary to WorkspaceFile (MongoDB Cloud) ---
        const WorkspaceFile = require('../models/WorkspaceFile');
        await WorkspaceFile.create({
            userId: user._id,
            documentId: newDoc._id,
            projectId: projectId || null,
            fileName: reportName,
            fileType: 'docx',
            fileData: buffer,
            size: buffer.length
        });

        console.log('[DocumentAnalysis] Saved report and cloud binary:', newDoc.name, String(newDoc._id));
    } catch (e) {
        console.error('[DocumentAnalysis] Failed to save report or binary:', e.message);
    }

    return {
        isAnalysisRequest: true,
        clarificationNeeded: false,
        analysisReport: {
            ...analysisResult,
            _meta: {
                analysisType: intentResult.analysisType,
                modules: intentResult.modules,
                docsAnalyzed: docs.map(d => ({ name: d.name, source: d.source })),
                timestamp: new Date().toISOString(),
                engine: engineUsed
            }
        },
        savedDoc,
        wordReportBuffer: buffer.toString('base64'),
        wordReportName: reportName
    };
};


module.exports = {
    runDocumentAnalysis,
    detectAnalysisIntent,
    buildDocumentSet
};
