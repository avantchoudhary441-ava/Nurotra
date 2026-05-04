require('dotenv').config({ path: './.env' });
const { processDocsAgentQuery } = require('./services/aiService');
const { detectLength, detectDocType } = require('./services/intentEngine');

async function testPerformance() {
    console.log("--- STARTING DOCS AGENT QUALITY VERIFICATION ---\n");

    const prompts = [
        "Prepare a professional Annual Report document for a company. The document should include sections such as company overview, mission and vision, yearly performance summary, major achievements, financial highlights, future goals, and management message.",
        "Create a short summary of a marketing campaign for a new energy drink.",
        "Generate a detailed technical specification for a microservices architecture including diagrams and security protocols."
    ];

    for (const prompt of prompts) {
        console.log(`\nTESTING PROMPT: "${prompt}"`);

        // 1. Check Intent Engine
        const docType = detectDocType(prompt);
        const length = detectLength(prompt);
        console.log(`Detected DocType: ${docType.type} (Confidence: ${docType.confidence})`);
        console.log(`Detected Length Preference: ${length}`);

        // 2. Check AI Service (Mocking context)
        console.log("Calling AI Service (this may take a moment)...");
        try {
            const result = await processDocsAgentQuery(prompt, { user: { name: "Test User" } });

            if (result.generation && result.generation.data) {
                const data = result.generation.data;
                console.log(`Generated Filename: ${data.fileName}`);
                console.log(`Sections count: ${data.sections.length}`);

                // Check for professional markers
                const hasHeader = !!data.header;
                const hasFooter = !!data.footer;
                const hasSynthesizedContent = data.sections.some(s => s.blocks.some(b => b.text && b.text.length > 50));

                console.log(`- Professional Header: ${hasHeader ? '✅' : '❌'}`);
                console.log(`- Professional Footer: ${hasFooter ? '✅' : '❌'}`);
                console.log(`- Synthesized Prose (Quality): ${hasSynthesizedContent ? '✅' : '❌'}`);

                if (length === 'DETAILED' && data.sections.length < 5) {
                    console.log(`- Length Check: ❌ (Expected >5 sections for detailed, got ${data.sections.length})`);
                } else if (length === 'SHORT' && data.sections.length > 4) {
                    console.log(`- Length Check: ⚠️ (Expected <4 sections for short, got ${data.sections.length})`);
                } else {
                    console.log(`- Length Check: ✅`);
                }
            } else {
                console.log("❌ FAILED: No structured generation data received.");
            }
        } catch (err) {
            console.error(`❌ ERROR: ${err.message}`);
        }
    }

    console.log("\n--- VERIFICATION COMPLETE ---");
}

testPerformance().catch(console.error);
