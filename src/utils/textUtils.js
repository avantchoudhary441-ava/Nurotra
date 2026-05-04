/**
 * Localizes text for profile inspection.
 * Replaces "You", "Your", and "Yours" with the profile name to make the UI feel appropriate for a visitor.
 * 
 * @param {string} text - The original text containing "You" or "Your".
 * @param {string} profileName - The name of the profile being viewed.
 * @param {boolean} isInspecting - Whether we are in inspection mode.
 * @returns {string} - The localized text.
 */
export const localizeText = (text, profileName, isInspecting) => {
    if (!isInspecting || !text) return text;

    // Fallback if name is missing
    const name = profileName || "The user";

    return text
        .replace(/\bYour\b/g, `${name}'s`)
        .replace(/\byour\b/g, `${name}'s`)
        .replace(/\bYou\b/g, name)
        .replace(/\byou\b/g, name.toLowerCase())
        .replace(/\bYours\b/g, `${name}'s`);
};
