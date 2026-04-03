const Resource = require('../models/Resource');
const aiService = require('./aiService');
const mongoose = require('mongoose');

/**
 * Resource Engine Service
 * Centralized logic for system resourcefulness.
 */
const resourceEngineService = {
    /**
     * Automatically ingest information from any agent activity.
     */
    autoIngest: async (userId, type, data, title, refId = null) => {
        try {
            console.log(`[ResourceEngine] Ingesting: ${title} (${type})`);
            
            const resource = await Resource.findOneAndUpdate(
                { userId, $or: [{ refId: refId }, { title: title, type: type }] },
                {
                    userId,
                    type,
                    title,
                    data,
                    refId,
                    lastMentioned: new Date()
                },
                { upsert: true, new: true }
            );
            
            return resource;
        } catch (error) {
            console.error('[ResourceEngine] Ingest failed:', error.message);
            return null;
        }
    },

    /**
     * Intelligent retrieval based on prompt context (Auto-Grounding).
     * Scans prompt for resource references and returns structured context.
     */
    autoGround: async (userId, prompt) => {
        try {
            console.log(`[ResourceEngine] Grounding prompt: "${prompt.substring(0, 50)}..."`);
            
            // 1. Local Regex/Keyword heuristics for fast resolution
            const resources = await Resource.find({ userId }).lean();
            const groundedResources = [];

            // A very basic fuzzy search for now - we can upgrade this to AI-driven resolution
            for (const res of resources) {
                const titleLower = res.title.toLowerCase();
                const promptLower = prompt.toLowerCase();
                
                // If title is explicitly mentioned
                if (promptLower.includes(titleLower)) {
                    groundedResources.push(res);
                } 
                // Or if tags are mentioned
                else if (res.tags.some(tag => promptLower.includes(tag.toLowerCase()))) {
                    groundedResources.push(res);
                }
            }

            if (groundedResources.length > 0) {
                console.log(`[ResourceEngine] Grounded ${groundedResources.length} resources.`);
            }

            return groundedResources;
        } catch (error) {
            console.error('[ResourceEngine] Grounding failed:', error.message);
            return [];
        }
    },

    /**
     * AI-Driven Resource Resolution (Advanced)
     * Uses LLM to identify specific resources from an ambiguous prompt.
     */
    resolveAmbiguous: async (userId, prompt) => {
        try {
            const resources = await Resource.find({ userId }).select('title type tags').lean();
            if (resources.length === 0) return [];

            const resourceContext = resources.map(r => `${r.title} (${r.type})`).join(', ');
            
            const systemPrompt = `Given the following user prompt and a list of available resources, identify which resources the user is referring to.
            Respond ONLY with a JSON array of indices from the list.
            
            RESOURCES:
            ${resourceContext}
            
            USER PROMPT:
            "${prompt}"`;

            const response = await aiService.generateWithFallback("Identify resources", systemPrompt);
            const indices = JSON.parse(response.replace(/```json/g, '').replace(/```/g, '').trim());
            
            return indices.map(idx => resources[idx]).filter(Boolean);
        } catch (error) {
            console.error('[ResourceEngine] AI Resolution failed:', error.message);
            return [];
        }
    }
};

module.exports = resourceEngineService;
