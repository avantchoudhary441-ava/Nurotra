const Project = require("../models/Project");
const Document = require("../models/Document");
const WorkspaceFile = require("../models/WorkspaceFile");
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

/**
 * Process Docs Agent Query
 * Route: POST /api/docs-agent/query
 */
const processQuery = async (req, res) => {
    const { prompt, history, currentDoc, docIds } = req.body;
    const hasOpenDoc = !!(currentDoc && (currentDoc.id || currentDoc._id));
    const selectedDocCount = docIds ? docIds.length : (hasOpenDoc ? 1 : 0);

    if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
    }

    try {
        const userContext = {
            name: req.user.name,
            role: req.user.role,
            niche: req.user.niche || "General"
        };

        // 1. Context-aware Intent Detection
        let intentInfo = contextualClassifyIntent(prompt, hasOpenDoc, selectedDocCount);
        let categoryOverride = null;

        // If confidence is low, trigger Intent Rescue (Invisible to user)
        if (intentInfo.confidence < 0.8) {
            console.log(`Debug: Low confidence (${intentInfo.confidence}). Rescuing intent via LLM...`);
            const rescue = await aiService.extractIntentWithLLM(prompt);
            // Only override if rescue gives CREATE — don't override MODIFY when doc is open
            if (!hasOpenDoc || rescue.intent === 'CREATE') {
                intentInfo.intent = rescue.intent;
            }
            categoryOverride = rescue.category;
            intentInfo.confidence = 0.9;
        }

        const risk = intentEngine.detectRisk(prompt);

        // 2. Advanced Operations Detection (e.g. multi-author merge, navigation pane, metadata inspection)
        const advancedOps = intentEngine.detectAdvancedOps(prompt);
        if (advancedOps.length > 0) {
            console.log(`Debug: Advanced Word ops detected: ${advancedOps.join(', ')}`);
        }

        // 3. Metadata Generation (Hybrid)
        const metadata = intentEngine.generateMetadata(prompt, intentInfo.intent, categoryOverride);

        // 4. Narrative Execution (AI Personality + Advanced Ops injection)
        const response = await aiService.processDocsAgentQuery(prompt, userContext, history, {
            intent: intentInfo.intent,
            risk,
            metadata,
            advancedOps,
            currentDoc,
            docIds, // Add this
            hasOpenDoc  // ← tells AI to use MODIFY system prompt
        });
        res.json(response);
    } catch (error) {
        console.error("Docs Agent Controller Error:", error);
        res.status(500).json({ message: "Failed to process agent query" });
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
        const { prompt, selectedDocIds: rawIds } = req.body;
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

        const result = await runDocumentAnalysis(prompt, selectedDocIds, uploadedFiles, req.user);

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
