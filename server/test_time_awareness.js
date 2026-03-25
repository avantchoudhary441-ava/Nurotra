/**
 * Verification Script: Time Awareness (Fixed)
 * Tests if the backend correctly generates temporal context.
 */

const { getTemporalContext, resolveSemanticDate } = require('./utils/timeHelper');

console.log("--- Testing Temporal Context Generation ---");
const context = getTemporalContext();
console.log(context);

if (context.includes("Today's Date:") && context.includes("[TEMPORAL_CONTEXT]")) {
    console.log("\n✅ SUCCESS: Temporal context is correctly structured.");
} else {
    console.log("\n❌ FAILURE: Missing required temporal tokens.");
}

// Check resolution logic
const today = new Date();
const yesterday = new Date();
yesterday.setDate(today.getDate() - 1);

const resolvedToday = resolveSemanticDate("What is today?");
const resolvedYesterday = resolveSemanticDate("How was yesterday?");

console.log(`\nToday Reference: ${today.toISOString().split('T')[0]}`);
console.log(`Resolved Today: ${resolvedToday.toISOString().split('T')[0]}`);
console.log(`Yesterday Reference: ${yesterday.toISOString().split('T')[0]}`);
console.log(`Resolved Yesterday: ${resolvedYesterday.toISOString().split('T')[0]}`);

if (resolvedToday.toDateString() === today.toDateString() &&
    resolvedYesterday.toDateString() === yesterday.toDateString()) {
    console.log("\n✅ SUCCESS: Semantic date resolution (deterministic) works.");
} else {
    console.log("\n❌ FAILURE: Semantic resolution error.");
}
