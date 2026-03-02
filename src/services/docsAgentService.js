import api from './apiService';

/**
 * Service for Docs Agent Cognitive Logic
 * Interfaces with the backend Gemini-powered LLM engine.
 */

export const docsAgentService = {
    /**
     * Parse human intent from a prompt
     * (Basic parsing for immediate UI feedback, 
     * real deep parsing happens in the backend LLM)
     */
    parseIntent: (prompt) => {
        const p = prompt.toLowerCase();
        if (p.includes('undo') || p.includes('rollback') || p.includes('pause') || p.includes('stop')) return 'CONTROL';
        if (p.includes('open') || p.includes('show') || p.includes('go to')) return 'NAVIGATE';
        if (p.includes('change') || p.includes('rewrite') || p.includes('add') || p.includes('insert') || p.includes('update') || p.includes('modify') || p.includes('fix')) return 'MODIFY';
        if (p.includes('create') || p.includes('make') || p.includes('generate') || p.includes('prepare') || p.includes('draft') || p.includes('write') || p.includes('compose')) return 'CREATE';
        return 'QUERY';
    },

    /**
     * Generate a context-aware, action-oriented response via Real AI Backend
     * @param {string} prompt 
     * @param {string} intent 
     * @param {object} context 
     * @returns {object} response message
     */
    generateResponse: async (prompt, intent, context = {}) => {
        try {
            const response = await api.post('/docs-agent/query', {
                prompt,
                history: context.history || [],
                currentDoc: context.currentDoc || null
            });

            // The backend returns { intent, text, clarification, steps? }
            return response.data;
        } catch (error) {
            // Log full error details for debugging
            console.error("Docs Agent AI Engine Failure:", error);
            if (error.response) {
                console.error("Server Response:", error.response.status, error.response.data);
            }

            // Re-throw error to let the caller handle it instead of showing generic fallback
            // This allows the actual error message to reach the user
            throw new Error(error.response?.data?.message || error.message || "Failed to connect to AI service");
        }
    },

    /**
     * Get all projects for current user
     */
    getProjects: async () => {
        try {
            const response = await api.get('/docs-agent/projects');
            return response.data;
        } catch (error) {
            console.error("Failed to fetch projects:", error);
            throw error;
        }
    },

    /**
     * Get all standalone documents
     */
    getDocuments: async () => {
        try {
            const response = await api.get('/docs-agent/documents');
            return response.data;
        } catch (error) {
            console.error("Failed to fetch documents:", error);
            throw error;
        }
    },

    /**
     * Initialize a new project container
     */
    createProject: async (projectData) => {
        try {
            const response = await api.post('/docs-agent/projects', projectData);
            return response.data;
        } catch (error) {
            console.error("Failed to create project:", error);
            throw error;
        }
    },

    /**
     * Create a document (standalone or within a project)
     */
    createDocument: async (docData) => {
        try {
            const response = await api.post('/docs-agent/documents', docData);
            return response.data;
        } catch (error) {
            console.error("Failed to create document:", error);
            throw error;
        }
    },

    /**
     * Update an existing document in-place
     */
    updateDocument: async (docId, updateData) => {
        try {
            const response = await api.put(`/docs-agent/documents/${docId}`, updateData);
            return response.data;
        } catch (error) {
            console.error("Failed to update document:", error);
            throw error;
        }
    },

    /**
     * Update document metadata (name, description, keywords)
     */
    updateDocumentMetadata: async (docId, { name, description, keywords }) => {
        try {
            const response = await api.put(`/docs-agent/documents/${docId}`, {
                name,
                description,
                keywords
            });
            return response.data;
        } catch (error) {
            console.error("Failed to update document metadata:", error);
            throw error;
        }
    },

    /**
     * Search documents and projects by keyword, name, or description
     */
    searchDocuments: async (query) => {
        try {
            const response = await api.get(`/docs-agent/documents/search?q=${encodeURIComponent(query)}`);
            return response.data;
        } catch (error) {
            console.error("Failed to search documents:", error);
            return { documents: [], projects: [] };
        }
    },

    /**
     * Semantic Metadata Extraction
     * Parsed by LLM to establish document execution context
     */
    extractMetadata: async (prompt) => {
        try {
            // This calls the LLM with a specific 'METADATA_EXTRACT' intent
            const response = await api.post('/docs-agent/extract-metadata', { prompt });
            return response.data; // Expected: { name, purpose, category, entities, confidence }
        } catch (error) {
            console.error("Metadata extraction failed, using local fallback:", error);

            // Smart local fallback naming
            const p = prompt.toLowerCase();
            let name = "New Document.docx";
            let category = "General";

            if (p.includes('market')) { name = "Marketing_Plan.docx"; category = "Marketing"; }
            else if (p.includes('legal') || p.includes('contract')) { name = "Contract_Draft.docx"; category = "Legal"; }
            else if (p.includes('tech') || p.includes('code')) { name = "Technical_Spec.docx"; category = "Technical"; }
            else if (p.includes('study') || p.includes('lesson')) { name = "Education_Material.docx"; category = "Education"; }
            else if (p.includes('budget') || p.includes('finance')) { name = "Financial_Report.xlsx"; category = "Finance"; }

            return {
                name: name,
                purpose: "Local fallback due to AI quota",
                category: category,
                entities: [],
                confidenceScore: 0.3
            };
        }
    },

    /**
     * Structure raw voice transcript into actionable intent
     */
    structureVoicePrompt: async (transcript) => {
        try {
            const response = await api.post('/docs-agent/structure-voice', { transcript });
            return response.data;
        } catch (error) {
            console.error("Failed to structure voice prompt:", error);
            throw error;
        }
    },

    /**
     * Manually trigger an automated save to local workspace
     */
    automateLocalSave: async (document, projectName, format) => {
        const response = await api.post('/docs-agent/automate-save', { document, projectName, format });
        return response.data;
    },

    /**
     * Open local workspace folder in File Explorer
     */
    openWorkspace: async (projectName) => {
        try {
            const response = await api.post('/docs-agent/open-workspace', { projectName });
            return response.data;
        } catch (error) {
            console.error("Failed to open workspace:", error);
            return null;
        }
    }
};
