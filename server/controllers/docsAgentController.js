const Project = require("../models/Project");
const Document = require("../models/Document");
const WorkspaceFile = require("../models/WorkspaceFile");
const axios = require("axios");
const aiService = require("../services/aiService");
const intentEngine = require("../services/intentEngine");
const { contextualClassifyIntent } = require("../services/intentEngine");
const { saveToCloud } = require("./workspaceController");
const { runDocumentAnalysis } = require("../services/documentAnalysisService");
const { extractCommandsFromFiles } = require("../services/commandExtractionService");

// Revaluation helper: compute next due date from interval
const computeNextDueDate = (interval, fromDate = new Date()) => {
    if (!interval) return null;
    const d = new Date(fromDate);
    switch (interval) {
        case 'weekly': d.setDate(d.getDate() + 7); break;
        case 'biweekly': d.setDate(d.getDate() + 14); break;
        case 'monthly': d.setDate(d.getDate() + 30); break;
        case 'quarterly': d.setDate(d.getDate() + 90); break;
        default: return null;
    }
    return d;
};

const intentAnalyzer = require("../services/agents/intentAnalyzer");
const classifier = require("../services/agents/classifier");
const structurePlanner = require("../services/agents/structurePlanner");
const contentGenerator = require("../services/agents/contentGenerator");
const designEngine = require("../services/agents/designEngine");
const renderingEngine = require("../services/agents/renderingEngine");

/**
 * Process Docs Agent Query (Advanced Modular Pipeline)
 * Route: POST /api/docs-agent/query
 */
const processQuery = async (req, res) => {
    let { prompt, history, currentDoc, docIds, links } = req.body;
    const uploadedFiles = req.files || [];

    // If FormData was used, certain fields might be JSON strings
    if (typeof history === 'string') try { history = JSON.parse(history); } catch { history = []; }
    if (typeof currentDoc === 'string') try { currentDoc = JSON.parse(currentDoc); } catch { currentDoc = null; }
    if (typeof docIds === 'string') try { docIds = JSON.parse(docIds); } catch { docIds = []; }
    if (typeof links === 'string') try { links = JSON.parse(links); } catch { links = []; }

    if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
    }

    try {
        console.log(`[DocsAgent] Starting Grounded 14-Stage Pipeline for: "${prompt.substring(0, 50)}..."`);

        // INGEST SOURCES: Fetch content from all attached materials
        let sourceContent = ""; // Final grounding text string

        // 1. Fetch from Sidebar/Project Documents
        if (docIds && docIds.length > 0) {
            const docs = await Document.find({ _id: { $in: docIds } });
            sourceContent += docs.map(d => `SOURCE [DOC: ${d.name}]:\n${d.content}`).join("\n\n");
        }

        // 2. Fetch from External Links (Web Grounding)
        if (links && links.length > 0) {
            for (const link of links) {
                try {
                    const response = await axios.get(link, { timeout: 10000 });
                    // Simple HTML-to-Text strategy
                    const cleanText = response.data.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                    sourceContent += `\n\nSOURCE [LINK: ${link}]:\n${cleanText.substring(0, 15000)}`;
                } catch (e) {
                    console.warn(`[DocsAgent] Failed to fetch link ${link}:`, e.message);
                }
            }
        }

        // 3. Fetch from Uploaded Files (Multimedia Handling)
        if (uploadedFiles.length > 0) {
            console.log(`[DocsAgent] Processing ${uploadedFiles.length} uploaded source files...`);

            // ALWAYS extract raw text first (this is our primary grounding source)
            try {
                const { buildDocumentSet } = require("../services/documentAnalysisService");
                const extractedDocs = await buildDocumentSet([], uploadedFiles);
                const totalExtractedLength = extractedDocs.reduce((acc, d) => acc + (d.content || "").length, 0);

                console.log(`[DocsAgent] Extraction Complete. Total characters: ${totalExtractedLength}`);

                sourceContent += `\n\n### CRITICAL GROUNDING SOURCE (UPLOADED FILES):\n`;
                sourceContent += extractedDocs.map(d => `[FILE: ${d.name}]\n${d.content || "EMPTY_FILE_CONTENT"}`).join("\n\n");

                if (totalExtractedLength < 100) {
                    console.warn("[DocsAgent] WARNING: Very little text extracted from files. Grounding may be weak.");
                }
            } catch (extErr) {
                console.warn("[DocsAgent] Raw text extraction failed:", extErr.message);
            }

            // SUPPLEMENT with deep analysis if structured insights are found
            try {
                const analysisResult = await runDocumentAnalysis(prompt, [], uploadedFiles, req.user);
                if (analysisResult.isAnalysisRequest && analysisResult.executiveSummary?.detailed) {
                    sourceContent += `\n\n### SUPPLEMENTAL ANALYSIS INSIGHTS:\n${analysisResult.executiveSummary.detailed.join("\n")}`;
                }
            } catch (awErr) {
                // Not a fatal error, we have the raw text grounding
            }
        }

        // VERIFY GROUNDING STRENGTH
        if (uploadedFiles.length > 0 && sourceContent.length < 500) {
            console.warn("[DocsAgent] CRITICAL: Grounding is weak after raw extraction. Attempting Python Recovery...");
            try {
                const { buildDocumentSet } = require("../services/documentAnalysisService");
                const docsForPython = await buildDocumentSet([], uploadedFiles);
                const { callPythonAnalysisEngine } = require("../services/documentAnalysisService");
                const pyInsights = await callPythonAnalysisEngine(docsForPython, prompt, "EXTRACT_INFO");
                if (pyInsights.processed_docs) {
                    sourceContent += "\n\n### RECOVERY SOURCE (PYTHON ENGINE):\n";
                    sourceContent += pyInsights.processed_docs.map(pd => pd.cleaned_snippet).join("\n");
                }
            } catch (pyErr) {
                console.error("[DocsAgent] Recovery failed:", pyErr.message);
            }
        }

        // multimediaContext: Original buffers for native AI ingestion (Gemini PDF support)
        const multimediaContext = uploadedFiles
            .filter(f => /\.pdf$/i.test(f.originalname) || (f.mimetype && f.mimetype.includes('pdf')))
            .map(f => ({
                mimeType: 'application/pdf',
                data: f.buffer.toString('base64'),
                fileName: f.originalname
            }));

        // OPTIMIZATION: Create a lightweight "brief" for earlier agents to prevent OOM
        const multimediaBrief = multimediaContext.map(mm => ({
            fileName: mm.fileName,
            mimeType: mm.mimeType,
            hint: `Multimodal context from PDF file: ${mm.fileName} is attached. Use it for specific names and facts.`
        }));

        // STAGE 1: INTENT ANALYSIS
        let intentData;
        try {
            // Pass the BRIEF instead of the full Base64 payload here
            intentData = await intentAnalyzer.analyzeIntent(prompt, sourceContent, multimediaBrief);
            console.log(`[Stage 1 OK] Intent:`, intentData.topic);
        } catch (st1Err) {
            console.error(`[Stage 1 FAILED]:`, st1Err.message);
            throw new Error(`Intent Analysis Error: ${st1Err.message}`);
        }

        // STAGE 2: CLASSIFICATION
        let classification;
        try {
            // Pass the BRIEF instead of the full Base64 payload here
            classification = await classifier.classifyType(prompt, intentData, multimediaBrief);
            console.log(`[Stage 2 OK] Type: ${classification.presentation_type}`);
        } catch (st2Err) {
            console.error(`[Stage 2 FAILED]:`, st2Err.message);
            throw new Error(`Classification Error: ${st2Err.message}`);
        }

        // STAGE 2.5: FASTAPI PYTHON AGENT INTERCEPTION FOR PPT
        if (intentData.output_format === 'ppt' || intentData.output_format === 'pptx') {
            console.log(`[DocsAgent] Intercepting PPT generation - Routing to Python CAMEL Agent...`);
            try {
                // Call the FastAPI Microservice
                const fastApiResponse = await axios.post('http://localhost:8000/api/agents/ppt', {
                    prompt: prompt,
                    context_data: sourceContent
                }, { timeout: 120000 }); // 2 minute timeout for agent generation

                const agentData = fastApiResponse.data;
                const processedSlides = agentData.slides;
                const b64File = agentData.base64_file;

                console.log(`[DocsAgent] Received generated PPT from Python Agent.`);

                // Convert B64 back to buffer for saving
                const pptBuffer = Buffer.from(b64File, 'base64');

                // Mock the expected structures for the rest of the flow to save correctly
                const classification = { presentation_type: "PPT_Agent_Generated" };
                const structure = { sections: processedSlides.map(s => ({ heading: s.title })) };
                const finalOutput = {
                    type: 'ppt',
                    buffer: pptBuffer,
                    fileName: (intentData.topic || 'Presentation').replace(/[<>:"/\\|?*]/g, '_').trim().replace(/\.pptx$/i, '') + '.pptx',
                    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                };

                const displayContent = processedSlides.map(s => `### ${s.heading || s.title}\n${(s.bullet_points || []).join('\n')}`).join('\n\n');

                console.log(`[DocsAgent] Received PPT Buffer from Python. Size: ${pptBuffer.length} bytes`);
                const document = new Document({
                    name: finalOutput.fileName,
                    type: 'ppt',
                    content: displayContent,
                    rawStructure: {
                        slides: processedSlides.map(s => ({
                            title: s.heading || s.title || "Slide",
                            bullets: s.bullet_points || []
                        })),
                        intent: intentData,
                        classification,
                        sections: processedSlides.map(s => ({ heading: s.heading || s.title }))
                    },
                    userId: req.user._id,
                    status: 'draft',
                    metadata: { purpose: intentData.purpose, confidenceScore: 0.99 }
                });
                await document.save();
                console.log(`[DocsAgent] Document saved with ID: ${document._id}`);

                // Explicitly save the beautifully generated Python PPTX buffer 
                // to WorkspaceFile so downloading retrieves the Camel PPT, 
                // instead of triggering a node-side PptxGenJS regeneration.
                await WorkspaceFile.findOneAndUpdate(
                    { userId: req.user._id, documentId: document._id },
                    {
                        userId: req.user._id,
                        documentId: document._id,
                        projectId: null,
                        fileName: finalOutput.fileName,
                        fileType: 'pptx',
                        fileData: pptBuffer,
                        size: pptBuffer.length
                    },
                    { upsert: true, new: true }
                );

                return res.json({
                    success: true,
                    document: { ...document._doc, id: document._id },
                    intent: intentData.purpose,
                    analysis: intentData,
                    classification,
                    structure,
                    content: processedSlides,
                    render: finalOutput,
                    generation: { type: 'ppt', data: finalOutput },
                    message: "Successfully generated PPT using Python Agents."
                });

            } catch (agentErr) {
                console.warn("[DocsAgent] Python Agent unavailable, falling back to Node.js PPT pipeline:", agentErr.message);
                // Fall through to the Node.js pipeline below
            }
        }

        // STAGE 3: STRUCTURE PLANNING (Continues as normal for Word/Website)
        let structure;
        try {
            structure = await structurePlanner.generateStructure(prompt, intentData, classification, sourceContent, multimediaContext);
            if (!structure.sections) throw new Error("Agent returned empty sections");
            console.log(`[Stage 3 OK] Sections: ${structure.sections.length}`);
        } catch (st3Err) {
            console.error(`[Stage 3 FAILED]:`, st3Err.message);
            throw new Error(`Structure Planning Error: ${st3Err.message}`);
        }

        // STAGE 6: CONTENT GENERATION
        let content;
        try {
            content = await contentGenerator.generateContent(prompt, intentData, structure, sourceContent, multimediaContext);
            if (!content.slides) throw new Error("Agent returned empty slides");
            console.log(`[Stage 6 OK] Content Generated.`);
        } catch (st4Err) {
            console.error(`[Stage 6 FAILED]:`, st4Err.message);
            throw new Error(`Content Generation Error: ${st4Err.message}`);
        }

        // STAGE 5 & 7: DESIGN INTELLIGENCE & VISUAL ENHANCEMENT
        let processedSlides;
        try {
            processedSlides = designEngine.processDesign(content.slides);
            console.log(`[Stage 5/7 OK] Design applied.`);
        } catch (st5Err) {
            console.error(`[Stage 5/7 FAILED]:`, st5Err.message);
            throw new Error(`Design Engine Error: ${st5Err.message}`);
        }

        // STAGE 11: RENDERING ENGINE
        const finalOutput = await renderingEngine.renderOutput({
            ...intentData,
            slides: processedSlides,
            topic: intentData.topic
        }, intentData.output_format);

        console.log(`[Stage 11] Rendering Complete for format: ${intentData.output_format}`);

        // PERSISTENCE: Save the generated document to MongoDB
        // Build a text representation of the content for the canvas view
        const displayContent = processedSlides.map(s => `### ${s.title}\n${s.bullets.join('\n')}`).join('\n\n');

        const document = new Document({
            name: (finalOutput && finalOutput.fileName) || intentData.topic || 'Generated_Document',
            type: intentData.output_format === 'website' ? 'website' : (intentData.output_format === 'ppt' ? 'ppt' : 'generic'),
            content: displayContent,
            rawStructure: {
                slides: processedSlides,
                intent: intentData,
                classification,
                sections: structure.sections
            },
            userId: req.user._id,
            status: 'draft',
            metadata: {
                purpose: intentData.purpose,
                confidenceScore: 0.98
            }
        });
        await document.save();

        // Respond with the comprehensive result (Stage 13)
        res.json({
            success: true,
            document: { ...document._doc, id: document._id },
            intent: intentData.purpose,
            analysis: intentData,
            classification,
            structure,
            content: processedSlides,
            render: finalOutput,
            generation: {
                type: intentData.output_format,
                data: finalOutput
            },
            message: `Successfully generated ${intentData.output_format} with advanced modular architecture.`
        });

    } catch (error) {
        console.error("Advanced Docs Agent Controller Error:", error);
        res.status(500).json({ message: "Modular pipeline failed", error: error.message });
    }
};

/**
 * Get all projects for current user
 * Route: GET /api/docs-agent/projects
 */
const getProjects = async (req, res) => {
    try {
        const projects = await Project.find({ userId: req.user._id }).sort({ updatedAt: -1 });

        // Populate documents for each project
        const now = new Date();
        const projectsWithDocs = await Promise.all(projects.map(async (project) => {
            const documents = await Document.find({ projectId: project._id });
            const projectIsDue = project.revaluation?.nextDueDate && new Date(project.revaluation.nextDueDate) <= now;
            return {
                ...project._doc,
                id: project._id,
                isDue: !!projectIsDue,
                docCount: documents.length,
                documents: documents.map(d => {
                    const docIsDue = d.revaluation?.nextDueDate && new Date(d.revaluation.nextDueDate) <= now;
                    return { ...d._doc, id: d._id, isDue: !!docIsDue };
                })
            };
        }));

        res.json(projectsWithDocs);
    } catch (error) {
        console.error("Get Projects Error:", error);
        res.status(500).json({ message: "Failed to fetch projects" });
    }
};

/**
 * Create a new project
 * Route: POST /api/docs-agent/projects
 */
const createProject = async (req, res) => {
    try {
        const { name, motive, keywords } = req.body;
        const project = new Project({
            name,
            motive,
            keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
            userId: req.user._id
        });
        await project.save();
        res.status(201).json({ ...project._doc, id: project._id });
    } catch (error) {
        console.error("Create Project Error:", error);
        res.status(500).json({ message: "Failed to create project" });
    }
};

/**
 * Get all standalone documents
 * Route: GET /api/docs-agent/documents
 */
const getDocuments = async (req, res) => {
    try {
        const documents = await Document.find({
            userId: req.user._id,
            projectId: { $exists: false }
        }).sort({ updatedAt: -1 });

        const now = new Date();
        res.json(documents.map(d => {
            const isDue = d.revaluation?.nextDueDate && new Date(d.revaluation.nextDueDate) <= now;
            return { ...d._doc, id: d._id, isDue: !!isDue };
        }));
    } catch (error) {
        console.error("Get Documents Error:", error);
        res.status(500).json({ message: "Failed to fetch documents" });
    }
};

/**
 * Create a new document
 * Route: POST /api/docs-agent/documents
 */
const createDocument = async (req, res) => {
    try {
        const { name, type, content, projectId, metadata, description, keywords } = req.body;
        const document = new Document({
            name,
            description: description || '',
            keywords: Array.isArray(keywords) ? keywords.map(k => k.trim()).filter(Boolean) : [],
            type,
            content,
            rawStructure: req.body.rawStructure,
            projectId,
            metadata,
            userId: req.user._id
        });
        await document.save();
        res.status(201).json({ ...document._doc, id: document._id });
    } catch (error) {
        console.error("Create Document Error:", error);
        res.status(500).json({ message: "Failed to create document" });
    }
};

/**
 * Update an existing document (in-place editing)
 * Route: PUT /api/docs-agent/documents/:id
 */
const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, content, rawStructure, metadata, description, keywords } = req.body;

        const document = await Document.findOne({ _id: id, userId: req.user._id });
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }

        // Update only the fields that are provided
        if (name) document.name = name;
        if (description !== undefined) document.description = description;
        if (keywords !== undefined) document.keywords = Array.isArray(keywords) ? keywords.map(k => k.trim()).filter(Boolean) : [];
        if (content !== undefined) document.content = content;
        if (rawStructure) document.rawStructure = rawStructure;
        if (metadata) document.metadata = { ...document.metadata, ...metadata };

        // Handle revaluation schedule
        if (req.body.revaluation !== undefined) {
            const reval = req.body.revaluation;
            if (reval && reval.interval) {
                document.revaluation = {
                    interval: reval.interval,
                    nextDueDate: computeNextDueDate(reval.interval),
                    lastRevaluedAt: document.revaluation?.lastRevaluedAt || null
                };
            } else {
                // Clear revaluation
                document.revaluation = { interval: null, nextDueDate: null, lastRevaluedAt: null };
            }
        }

        document.updatedAt = new Date();

        await document.save();
        res.json({ ...document._doc, id: document._id });
    } catch (error) {
        console.error("Update Document Error:", error);
        res.status(500).json({ message: "Failed to update document" });
    }
};

/**
 * Extract semantic metadata from prompt
 * Route: POST /api/docs-agent/extract-metadata
 */
const extractMetadata = async (req, res) => {
    try {
        const { prompt } = req.body;
        // Use deterministic metadata generation first
        const metadata = intentEngine.generateMetadata(prompt);
        res.json(metadata);
    } catch (error) {
        console.error("Extract Metadata Error:", error);
        res.status(500).json({ message: "Failed to extract metadata" });
    }
};

/**
 * Structure voice transcript
 * Route: POST /api/docs-agent/structure-voice
 */
const structureVoicePrompt = async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript) {
            return res.status(400).json({ message: "Transcript is required" });
        }
        const userContext = {
            name: req.user.name,
            role: req.user.role,
            niche: req.user.niche || "General"
        };

        // Deterministic Cleanup
        const cleanTranscript = intentEngine.cleanVoiceTranscript(transcript);

        const structured = await aiService.structureVoiceIntent(cleanTranscript, userContext);
        res.json(structured);
    } catch (error) {
        console.error("Structure Voice Error:", error);
        res.status(500).json({ message: "Failed to structure voice input" });
    }
};

/**
 * Save document to cloud workspace (MongoDB)
 * Route: POST /api/docs-agent/automate-save
 */
const automateLocalSave = async (req, res) => {
    try {
        const { document, projectName, format } = req.body;
        if (!document) {
            return res.status(400).json({ message: "Document data required" });
        }

        // Resolve documentId — support both id and _id fields
        const documentId = document.id || document._id;
        if (!documentId) {
            return res.status(400).json({ message: "Document must have an id to be saved to cloud workspace" });
        }

        // Find projectId from name if provided
        let projectId = null;
        if (projectName) {
            const project = await Project.findOne({ name: projectName, userId: req.user._id });
            if (project) projectId = project._id;
        }

        const result = await saveToCloud(document, req.user._id, documentId, projectId, format);
        res.json({ message: "Saved to cloud workspace", fileName: result.fileName });
    } catch (error) {
        console.error("Cloud Save Error:", error);
        res.status(500).json({ message: "Failed to save to cloud workspace", error: error.message });
    }
};

/**
 * Open workspace — now returns cloud file list (filesystem no longer used)
 * Route: POST /api/docs-agent/open-workspace
 */
const openWorkspace = async (req, res) => {
    res.json({ message: "Files are stored in your cloud workspace. Use /api/workspace/list to browse them." });
};

/**
 * Search documents and projects by keyword, name, or description
 * Route: GET /api/docs-agent/documents/search?q=<query>
 */
const searchDocuments = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.json({ documents: [], projects: [] });
        }

        const searchTerm = q.trim();
        const searchRegex = new RegExp(searchTerm, 'i');

        // Search documents by name, description, or keywords
        const documents = await Document.find({
            userId: req.user._id,
            $or: [
                { name: searchRegex },
                { description: searchRegex },
                { keywords: searchRegex }
            ]
        }).sort({ updatedAt: -1 }).limit(10);

        // Search projects by name, motive, or keywords
        const projects = await Project.find({
            userId: req.user._id,
            $or: [
                { name: searchRegex },
                { motive: searchRegex },
                { keywords: searchRegex }
            ]
        }).sort({ updatedAt: -1 }).limit(10);

        res.json({
            documents: documents.map(d => ({ ...d._doc, id: d._id, matchType: 'document' })),
            projects: projects.map(p => ({ ...p._doc, id: p._id, matchType: 'project' }))
        });
    } catch (error) {
        console.error("Search Documents Error:", error);
        res.status(500).json({ message: "Failed to search documents" });
    }
};

/**
 * Delete a document and its associated workspace file
 * Route: DELETE /api/docs-agent/documents/:id
 */
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await Document.findOne({ _id: id, userId: req.user._id });
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }
        // Delete the binary workspace file if it exists
        await WorkspaceFile.deleteOne({ documentId: id, userId: req.user._id });
        // Delete the document record
        await Document.deleteOne({ _id: id, userId: req.user._id });
        res.json({ message: "Document deleted successfully", id });
    } catch (error) {
        console.error("Delete Document Error:", error);
        res.status(500).json({ message: "Failed to delete document" });
    }
};

/**
 * Mark a document as revaluated (reset the timer)
 * Route: POST /api/docs-agent/documents/:id/mark-revaluated
 */
const markRevaluated = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await Document.findOne({ _id: id, userId: req.user._id });
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }
        if (!document.revaluation?.interval) {
            return res.status(400).json({ message: "Document has no revaluation schedule" });
        }

        const now = new Date();
        document.revaluation.lastRevaluedAt = now;
        document.revaluation.nextDueDate = computeNextDueDate(document.revaluation.interval, now);
        await document.save();

        res.json({ ...document._doc, id: document._id, isDue: false });
    } catch (error) {
        console.error("Mark Revaluated Error:", error);
        res.status(500).json({ message: "Failed to mark document as revaluated" });
    }
};

/**
 * Document Analysis Endpoint
 * Route: POST /api/docs-agent/analyze
 * Accepts multipart/form-data with:
 *   - prompt (string)
 *   - selectedDocIds (JSON array string)
 *   - files[] (optional uploaded files via multer)
 */
const analyzeDocuments = async (req, res) => {
    try {
        const { prompt, selectedDocIds: rawIds, projectId } = req.body;
        const uploadedFiles = req.files || [];

        if (!prompt) {
            return res.status(400).json({ message: 'Prompt is required' });
        }

        let selectedDocIds = [];
        try {
            selectedDocIds = rawIds ? JSON.parse(rawIds) : [];
        } catch { selectedDocIds = []; }

        const totalDocs = selectedDocIds.length + uploadedFiles.length;
        if (totalDocs === 0) {
            return res.status(400).json({ message: 'No documents provided for analysis' });
        }

        const result = await runDocumentAnalysis(prompt, selectedDocIds, uploadedFiles, req.user, projectId);


        if (!result.isAnalysisRequest) {
            // Not an analysis prompt — return signal to frontend to handle normally
            return res.json({ isAnalysisRequest: false });
        }

        if (result.clarificationNeeded) {
            return res.json({
                isAnalysisRequest: true,
                clarificationNeeded: true,
                clarificationMessage: result.clarificationMessage
            });
        }

        // Refresh sidebar by returning all standalone docs
        const updatedDocs = await Document.find({ user: req.user._id, projectId: null }).sort({ createdAt: -1 });

        return res.json({
            isAnalysisRequest: true,
            clarificationNeeded: false,
            analysisReport: result.analysisReport,
            savedDoc: result.savedDoc,
            wordReportName: result.wordReportName,
            wordReportBuffer: result.wordReportBuffer,
            updatedDocs: updatedDocs.map(d => ({ ...d._doc, id: d._id }))
        });
    } catch (error) {
        console.error('[analyzeDocuments] Error:', error);
        res.status(500).json({ message: 'Document analysis failed. Please try again.' });
    }
};

module.exports = {
    processQuery,
    getProjects,
    createProject,
    getDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    searchDocuments,
    extractMetadata,
    structureVoicePrompt,
    automateLocalSave,
    openWorkspace,
    markRevaluated,
    analyzeDocuments,
    extractCommands: async (req, res) => {
        try {
            const { userText } = req.body;
            const files = req.files || [];

            if (files.length === 0) {
                return res.status(400).json({ success: false, message: "No files uploaded" });
            }

            const result = await extractCommandsFromFiles(files, userText);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error("[DocsAgentController] Extract command error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
