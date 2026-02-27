const Project = require("../models/Project");
const Document = require("../models/Document");
const aiService = require("../services/aiService");
const intentEngine = require("../services/intentEngine");
const localExportService = require("../services/localExportService");

/**
 * Process Docs Agent Query
 * Route: POST /api/docs-agent/query
 */
const processQuery = async (req, res) => {
    const { prompt, history, currentDoc } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
    }

    try {
        const userContext = {
            name: req.user.name,
            role: req.user.role,
            niche: req.user.niche || "General"
        };

        // 1. Hybrid Intent Detection (Invisible Intelligence)
        let intentInfo = intentEngine.classifyIntent(prompt);
        let categoryOverride = null;

        // If confidence is low, trigger Intent Rescue (Invisible to user)
        if (intentInfo.confidence < 0.8) {
            console.log(`Debug: Low confidence (${intentInfo.confidence}). Rescuing intent via LLM...`);
            const rescue = await aiService.extractIntentWithLLM(prompt);
            intentInfo.intent = rescue.intent;
            categoryOverride = rescue.category;
            intentInfo.confidence = 0.9; // Boost confidence after rescue
        }

        const risk = intentEngine.detectRisk(prompt);

        // 2. Metadata Generation (Hybrid)
        const metadata = intentEngine.generateMetadata(prompt, intentInfo.intent, categoryOverride);

        // 3. Narrative Execution (AI Personality)
        const response = await aiService.processDocsAgentQuery(prompt, userContext, history, {
            intent: intentInfo.intent,
            risk,
            metadata,
            currentDoc // Pass the current document for iterative editing
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
        const projectsWithDocs = await Promise.all(projects.map(async (project) => {
            const documents = await Document.find({ projectId: project._id });
            return {
                ...project._doc,
                id: project._id,
                docCount: documents.length,
                documents: documents.map(d => ({ ...d._doc, id: d._id }))
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

        res.json(documents.map(d => ({ ...d._doc, id: d._id })));
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
 * Automatically save document to local workspace
 * Route: POST /api/docs-agent/automate-save
 */
const automateLocalSave = async (req, res) => {
    try {
        const { document, projectName, format } = req.body;
        if (!document) {
            return res.status(400).json({ message: "Document data required" });
        }

        const result = await localExportService.automateLocalSave(document, projectName, req.user.name, format);
        res.json({ message: "Synced to workspace successfully", path: result.path });
    } catch (error) {
        console.error("Automated Save Error:", error);
        res.status(500).json({ message: "Failed to sync to workspace" });
    }
};

/**
 * Open local workspace folder in explorer
 * Route: POST /api/docs-agent/open-workspace
 */
const openWorkspace = async (req, res) => {
    try {
        const { projectName } = req.body;
        await localExportService.openWorkspace(projectName, req.user.name);
        res.json({ message: "Workspace opened in explorer" });
    } catch (error) {
        console.error("Open Workspace Error:", error);
        res.status(500).json({ message: "Failed to open workspace folder" });
    }
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
 * Trigger Folder Picker and Register Workspace
 * Route: POST /api/docs-agent/workspaces/pick
 */
const pickAndRegisterWorkspace = async (req, res) => {
    try {
        const path = await localExportService.pickFolder();
        if (!path) {
            return res.json({ cancelled: true });
        }
        res.json({ path });
    } catch (error) {
        console.error("Pick Workspace Error:", error);
        res.status(500).json({ message: "Failed to open folder picker" });
    }
};

/**
 * Get Workspace File Tree
 * Route: GET /api/docs-agent/workspaces/tree?path=<path>
 */
const getWorkspaceTree = async (req, res) => {
    try {
        const { path } = req.query;
        if (!path) return res.status(400).json({ message: "Path is required" });

        const tree = localExportService.scanDirectory(path);
        res.json(tree);
    } catch (error) {
        console.error("Get Tree Error:", error);
        res.status(500).json({ message: "Failed to scan directory" });
    }
};

/**
 * Get Recent Workspace Files
 * Route: GET /api/docs-agent/workspaces/recent?path=<path>
 */
const getRecentWorkspaceFiles = async (req, res) => {
    try {
        const { path } = req.query;
        if (!path) return res.status(400).json({ message: "Path is required" });

        const recent = localExportService.getRecentFiles(path);
        res.json(recent);
    } catch (error) {
        console.error("Get Recent Error:", error);
        res.status(500).json({ message: "Failed to fetch recent files" });
    }
};

module.exports = {
    processQuery,
    getProjects,
    createProject,
    getDocuments,
    createDocument,
    updateDocument,
    searchDocuments,
    extractMetadata,
    structureVoicePrompt,
    automateLocalSave,
    openWorkspace,
    pickAndRegisterWorkspace,
    getWorkspaceTree,
    getRecentWorkspaceFiles
};
