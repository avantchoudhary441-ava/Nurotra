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
        if (p.includes('change') || p.includes('rewrite') || p.includes('add') || p.includes('insert')) return 'MODIFY';
        if (p.includes('create') || p.includes('make') || p.includes('generate')) return 'CREATE';
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
                history: context.history || []
            });

            // The backend returns { intent, text, clarification, steps? }
            return response.data;
        } catch (error) {
            console.error("Docs Agent AI Engine Failure:", error);
            // Soulful Fallback if API fails
            return {
                text: "My cognitive link is shielding a minor interference. ⚙️ Let's try that again, or I can focus on your local documents for a moment. 💡",
                clarification: {
                    options: [
                        { label: "Retry", action: "RETRY_QUERY" },
                        { label: "Check docs", action: "SEARCH_DOCS" }
                    ]
                },
                intent: 'QUERY'
            };
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
     * Semantic Metadata Extraction
     * Parsed by LLM to establish document execution context
     */
    extractMetadata: async (prompt) => {
        try {
            // This calls the LLM with a specific 'METADATA_EXTRACT' intent
            const response = await api.post('/docs-agent/extract-metadata', { prompt });
            return response.data; // Expected: { name, purpose, category, entities, confidence }
        } catch (error) {
            console.error("Metadata extraction failed:", error);
            return {
                name: "Draft Document",
                purpose: "General Execution",
                category: "Generic",
                entities: [],
                confidenceScore: 0.5
            };
        }
    }
};
