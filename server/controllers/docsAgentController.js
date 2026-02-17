const Project = require("../models/Project");
const Document = require("../models/Document");
const aiService = require("../services/aiService");

/**
 * Process Docs Agent Query
 * Route: POST /api/docs-agent/query
 */
const processQuery = async (req, res) => {
    const { prompt, history } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
    }

    try {
        const userContext = {
            name: req.user.name,
            role: req.user.role,
            niche: req.user.niche || "General"
        };

        const response = await aiService.processDocsAgentQuery(prompt, userContext, history);
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
        const { name, type, content, projectId, metadata } = req.body;
        const document = new Document({
            name,
            type,
            content,
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
 * Extract semantic metadata from prompt
 * Route: POST /api/docs-agent/extract-metadata
 */
const extractMetadata = async (req, res) => {
    try {
        const { prompt } = req.body;
        const metadata = await aiService.extractMetadata(prompt);
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
        const structured = await aiService.structureVoiceIntent(transcript, userContext);
        res.json(structured);
    } catch (error) {
        console.error("Structure Voice Error:", error);
        res.status(500).json({ message: "Failed to structure voice input" });
    }
};

module.exports = {
    processQuery,
    getProjects,
    createProject,
    getDocuments,
    createDocument,
    extractMetadata,
    structureVoicePrompt
};
