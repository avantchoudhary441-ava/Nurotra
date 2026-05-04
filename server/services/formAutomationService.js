/**
 * FORM AUTOMATION & SUBMISSION ENGINE
 * 
 * Extends Action Agent with capabilities to detect, fill, and submit forms.
 */

const User = require("../models/User");
const Influencer = require("../models/Influencer");
const NuroMemory = require("../models/NuroMemory");
const { generateWithFallback } = require("./aiService");

/**
 * Maps environment fields to user profile data using semantic matching.
 */
const mapContextualData = async (fields, userId) => {
    const user = await User.findById(userId);
    const influencer = await Influencer.findOne({ userId });
    const memory = await NuroMemory.findOne({ userId });
    
    // Check for Preferred Identity Email
    const { getPreferredEmail } = require("./agentResourceService");
    const preferredEmail = await getPreferredEmail(userId);

    // Look for a resume in the Document collection
    const Document = require("../models/Document");
    const resumeDoc = await Document.findOne({ 
        userId, 
        name: { $regex: /resume|cv|biodata/i } 
    }).sort({ updatedAt: -1 });

    const profileData = {
        name: user?.name || influencer?.fullName,
        email: preferredEmail || user?.email || influencer?.email,
        phone: influencer?.contactNumber,
        platform_url: influencer?.platformUrl,
        social_handle: influencer?.socialHandle,
        niche: influencer?.niche,
        mission: memory?.longTermPlan?.mission,
        resume_name: resumeDoc?.name || "Not uploaded",
        resume_link: resumeDoc?.url || null, // <--- Provide the physical asset link for browser automation
        resume_internal_link: resumeDoc ? `https://nurotra.com/documents/${resumeDoc._id}` : null,
        // Added standard fields for common forms
        website: influencer?.platformUrl || "Not specified",
        location: influencer?.targetingLocation?.join(", ") || "Global"
    };

    // Use AI to map fields if confidence is low, otherwise direct match
    const mappingPrompt = `
    Given the following user profile data:
    ${JSON.stringify(profileData, null, 2)}

    Determine the best value for each of these form fields based on the field name and labels:
    ${JSON.stringify(fields, null, 2)}

    Return a JSON object where keys are the field names and values are the mapped data.
    If no match found, use null.
    `;

    try {
        const response = await generateWithFallback(mappingPrompt, "You are a data mapping engine. Match form fields to user profile data intelligently.");
        const cleanedResponse = response.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanedResponse);
    } catch (e) {
        console.error("[FormAuto] Mapping failed:", e);
        // Fallback to simple direct mapping if AI fails
        const mapped = {};
        fields.forEach(f => {
            const label = (f.label || f.name || "").toLowerCase();
            if (label.includes("name")) mapped[f.name] = profileData.name;
            else if (label.includes("email")) mapped[f.name] = profileData.email;
            else if (label.includes("phone")) mapped[f.name] = profileData.phone;
        });
        return mapped;
    }
};

/**
 * Scans the provided environment context for detectable form elements.
 * Returns a list of form fields with labels and attributes.
 */
const detectFormFields = (environmentContext) => {
    // If context contains explicit fields, use them
    if (environmentContext.fields && Array.isArray(environmentContext.fields)) {
        return environmentContext.fields;
    }

    // Otherwise, simulate detection based on page description
    const description = (environmentContext.description || "").toLowerCase();
    
    // Default form structures for common intents if not explicitly provided
    if (description.includes("job") || description.includes("internship") || description.includes("apply")) {
        return [
            { name: "full_name", label: "Full Name", type: "text", required: true },
            { name: "email", label: "Email Address", type: "email", required: true },
            { name: "phone", label: "Phone Number", type: "tel", required: true },
            { name: "resume", label: "Resume/CV", type: "file", required: true },
            { name: "portfolio", label: "Portfolio URL", type: "url", required: false }
        ];
    }
    
    if (description.includes("register") || description.includes("sign up")) {
        return [
            { name: "username", label: "Username", type: "text", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "password", label: "Password", type: "password", required: true }
        ];
    }

    return []; // Return empty if nothing detected
};

/**
 * Validates the filled data against required attributes.
 */
const validateForm = (fields, data) => {
    const errors = [];
    fields.forEach(f => {
        if (f.required && !data[f.name]) {
            errors.push(`${f.label} is required.`);
        }
    });

    // Semantic validation
    if (data.email && !data.email.includes("@")) {
        errors.push("Invalid email format.");
    }

    return { isValid: errors.length === 0, errors };
};

module.exports = {
    detectFormFields,
    mapContextualData,
    validateForm
};
