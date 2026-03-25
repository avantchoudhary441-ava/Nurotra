/**
 * Time Helper Utility
 * Provides centralized temporal context for AI agents.
 */

const getTemporalContext = () => {
    const now = new Date();

    // Format options for a rich human-readable string
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    };

    const humanReadable = now.toLocaleString('en-US', options);
    const isoDate = now.toISOString().split('T')[0];
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

    // Calculate relative dates for better grounding
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    return `
[TEMPORAL_CONTEXT]
Current Time: ${humanReadable}
Today's Date: ${isoDate} (${dayOfWeek})
Yesterday was: ${yesterday.toISOString().split('T')[0]}
Tomorrow is: ${tomorrow.toISOString().split('T')[0]}
Month: ${now.toLocaleString('en-US', { month: 'long' })}
Year: ${now.getFullYear()}
    `.trim();
};

/**
 * Resolves a semantic date from a reference string
 * (Simplified version of what the LLM will actually do, 
 * but useful for deterministic checks)
 */
const resolveSemanticDate = (text) => {
    const now = new Date();
    const lower = text.toLowerCase();

    if (lower.includes('today')) return now;
    if (lower.includes('yesterday')) {
        const d = new Date(now);
        d.setDate(now.getDate() - 1);
        return d;
    }
    if (lower.includes('tomorrow')) {
        const d = new Date(now);
        d.setDate(now.getDate() + 1);
        return d;
    }
    return now;
};

module.exports = {
    getTemporalContext,
    resolveSemanticDate
};
