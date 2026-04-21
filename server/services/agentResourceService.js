const Resource = require("../models/Resource");
const { generateWithFallback } = require("./aiService");

/**
 * Intelligent Resource Ingestion Service
 * 
 * Handles parsing, structuring, and storing user-provided data (like resumes) 
 * for future use by the Action Agent.
 */

/**
 * Structure raw resume text into a functional Skill Profile for the Resource Engine.
 * @param {string} userId 
 * @param {string} rawContent - The plain text extracted from the document
 * @param {string} documentId - The source document ID
 */
const ingestResume = async (userId, rawContent, documentId) => {
    console.log(`[ResourceService] Ingesting resume for user: ${userId}`);
    
    const extractionPrompt = `
    Analyze the following resume content and extract a structured Skill Profile.
    Content:
    ${rawContent.substring(0, 5000)} // Limiting to prevent token overflow

    Output STRICT JSON with these keys:
    1. "name": User's full name
    2. "email": User's email
    3. "summary": A 1-2 sentence professional summary
    4. "top_skills": Array of top 10 technical or professional skills
    5. "experience_highlights": Array of 3-5 key achievements or roles
    6. "education": Highest degree and institution
    
    No markdown. No extra text.
    `;

    try {
        const responseText = await generateWithFallback(extractionPrompt, "You are a professional resume analyst. Extract structured profile data accurately.");
        const profileData = JSON.parse(responseText.replace(/```json|```/g, '').trim());

        // Save as a searchable Resource
        const resource = new Resource({
            userId,
            title: `Master Profile: ${profileData.name || 'User'}`,
            type: 'data',
            data: profileData,
            refId: documentId,
            tags: ['user_profile', 'resume_data', 'skill_map', 'master_data']
        });

        await resource.save();
        console.log(`[ResourceService] Successfully ingested profile for ${profileData.name}`);
        
        return {
            success: true,
            resourceId: resource._id,
            profile: profileData
        };
    } catch (error) {
        console.error("[ResourceService] Ingestion failed:", error);
        throw error;
    }
};

/**
 * Retrieves the user's master profile for grounding agent tasks.
 * @param {string} userId 
 */
const getMasterProfile = async (userId) => {
    return await Resource.findOne({ 
        userId, 
        tags: { $all: ['user_profile', 'master_data'] } 
    }).sort({ updatedAt: -1 });
};

module.exports = {
    ingestResume,
    getMasterProfile
};
