import api from './apiService';

// Helper: trigger a browser file download from a blob response
const triggerBlobDownload = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

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
            const hasOpenDoc = !!(context.currentDoc && (context.currentDoc.id || context.currentDoc._id));
            const response = await api.post('/docs-agent/query', {
                prompt,
                history: context.history || [],
                currentDoc: context.currentDoc || null,
                docIds: context.docIds || [],
                hasOpenDoc   // ← tells controller/AI to use MODIFY path
            });

            // The backend returns { intent, text, clarification, steps? }
            return response.data;
        } catch (error) {
            console.error("Docs Agent AI Engine Failure:", error);
            
            let message = "Failed to connect to AI service";
            if (error.response) {
                // The server responded with a status code
                message = error.response.data?.message || `Server Error (${error.response.status})`;
                if (error.response.status === 503) {
                    message = "AI Provider is currently unavailable. Please check your OpenAI API key.";
                }
            } else if (error.request) {
                // The request was made but no response was received
                message = "Network Error: The backend server is unreachable. Please ensure the server is running.";
            } else {
                message = error.message;
            }

            throw new Error(message);
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
     * Update document metadata (name, description, keywords, revaluation)
     */
    updateDocumentMetadata: async (docId, { name, description, keywords, revaluation }) => {
        try {
            const payload = { name, description, keywords };
            if (revaluation !== undefined) payload.revaluation = revaluation;
            const response = await api.put(`/docs-agent/documents/${docId}`, payload);
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
    },
    /**
     * Download a file from the cloud workspace by document ID.
     * Triggers a real browser download.
     */
    downloadFile: async (documentId, fileName, format) => {
        try {
            console.log(`[docsAgentService] downloadFile: ${documentId}, format: ${format}`);
            const url = format
                ? `/workspace/download/${documentId}?format=${format}`
                : `/workspace/download/${documentId}`;

            const response = await api.get(url, {
                responseType: 'blob'
            });

            // Extract filename from Content-Disposition (handles case-insensitivity)
            let finalName = fileName || 'document';
            const cdHeader = response.headers['content-disposition'] || response.headers['Content-Disposition'];

            if (cdHeader) {
                const match = cdHeader.match(/filename="?([^"]+)"?/);
                if (match && match[1]) {
                    finalName = match[1];
                }
            } else if (format && !finalName.toLowerCase().endsWith('.' + format)) {
                // Heuristic: if header is missing, at least try to append correct extension
                const extensionMap = { pbi: 'xlsx' };
                const ext = extensionMap[format] || format;
                finalName = finalName.split('.')[0] + '.' + ext;
            }

            console.log(`[docsAgentService] Triggering download with name: ${finalName}`);
            triggerBlobDownload(response.data, finalName);
            return { success: true };
        } catch (error) {
            console.error('Failed to download file:', error);

            // Handle Blob error response: convert blob to JSON
            if (error.response?.data instanceof Blob) {
                const blob = error.response.data;
                const reader = new FileReader();
                const errorData = await new Promise((resolve) => {
                    reader.onload = () => {
                        try {
                            resolve(JSON.parse(reader.result));
                        } catch (e) {
                            resolve({ message: "Unknown download error" });
                        }
                    };
                    reader.readAsText(blob);
                });
                throw new Error(errorData.message || "Failed to download file");
            }

            throw new Error(error.response?.data?.message || error.message || "Failed to download file");
        }
    },

    /**
     * List all files in the cloud workspace for the current user.
     */
    listWorkspace: async () => {
        try {
            const response = await api.get('/workspace/list');
            return response.data;
        } catch (error) {
            console.error('Failed to list workspace:', error);
            return [];
        }
    },

    /**
     * Delete a document and its associated workspace file from MongoDB.
     */
    deleteDocument: async (documentId) => {
        try {
            const response = await api.delete(`/docs-agent/documents/${documentId}`);
            return response.data;
        } catch (error) {
            console.error('Failed to delete document:', error);
            throw error;
        }
    },

    /**
     * Mark a document as revaluated (reset the revaluation timer)
     */
    markRevaluated: async (docId) => {
        try {
            const response = await api.post(`/docs-agent/documents/${docId}/mark-revaluated`);
            return response.data;
        } catch (error) {
            console.error('Failed to mark document as revaluated:', error);
            throw error;
        }
    },

    /**
     * Document Analysis — core analysis endpoint.
     * Sends prompt + sidebar-selected IDs + uploaded file blobs as multipart/form-data.
     * @param {string} prompt - User's analysis prompt
     * @param {string[]} selectedDocIds - IDs of sidebar selected docs
     * @param {File[]} uploadedFiles - FileList or array of File objects from paperclip
     * @returns Analysis report JSON + savedDoc reference
     */
    analyzeDocuments: async (prompt, selectedDocIds = [], uploadedFiles = []) => {
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('selectedDocIds', JSON.stringify(selectedDocIds));
        uploadedFiles.forEach(f => formData.append('files', f));

        const response = await api.post('/docs-agent/analyze', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    /**
     * Extract actionable commands from uploaded files/images.
     * @param {File[]} files - Files to extract commands from
     * @param {string} userText - Optional accompanying text
     */
    extractCommandFromFiles: async (files, userText = '') => {
        const formData = new FormData();
        formData.append('userText', userText);
        files.forEach(f => formData.append('files', f));

        const response = await api.post('/docs-agent/extract-command', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    }
};

