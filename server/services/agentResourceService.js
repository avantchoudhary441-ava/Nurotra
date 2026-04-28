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
    Analyze the following content and extract a structured Skill Profile.
    
    CRITICAL VALIDATION:
    Is this a professional resume? (Check for work history, skills, education, professional formatting).
    Set "isResume": true if it is a resume, or false if it is junk content, a random image description, or unrelated text.
    
    Content:
    ${rawContent.substring(0, 5000)}

    Output STRICT JSON with these keys:
    1. "isResume": Boolean
    2. "name": User's full name
    3. "email": User's email found in resume
    4. "summary": A 1-2 sentence professional summary
    5. "top_skills": Array of top 10 technical or professional skills
    6. "experience_highlights": Array of 3-5 key achievements or roles
    7. "education": Highest degree and institution
    
    No markdown. No extra text.
    `;

    try {
        const responseText = await generateWithFallback(extractionPrompt, "You are a professional resume analyst and authenticity validator.");
        const profileData = JSON.parse(responseText.replace(/```json|```/g, '').trim());

        if (profileData.isResume === false) {
            console.warn(`[ResourceService] Validation failed: Document is NOT a resume.`);
            return {
                success: false,
                error: "INVALID_RESUME",
                message: "This document does not resemble a professional resume."
            };
        }

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
        console.log(`[ResourceService] Successfully ingested verified profile for ${profileData.name}`);
        
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
 * Saves or updates the user's preferred professional identity email.
 */
const savePreferredEmail = async (userId, email) => {
    // Delete old identity if it exists to keep it unique
    await Resource.deleteMany({ userId, tags: 'preferred_identity' });

    const identityRes = new Resource({
        userId,
        title: "Preferred Job Identity",
        type: 'data',
        data: { preferred_email: email },
        tags: ['preferred_identity', 'identity_data']
    });

    await identityRes.save();
    return identityRes;
};

/**
 * Retrieves the preferred email if it exists.
 */
const getPreferredEmail = async (userId) => {
    const res = await Resource.findOne({ userId, tags: 'preferred_identity' });
    return res ? res.data.preferred_email : null;
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
    getMasterProfile,
    savePreferredEmail,
    getPreferredEmail
};
