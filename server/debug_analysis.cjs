const { runDocumentAnalysis } = require('./services/documentAnalysisService');
require('dotenv').config();

const mockUser = { _id: '64f1a2b3c4d5e6f7a8b9c0d1', name: 'Test User' };

async function testAnalysis() {
    console.log('--- Starting Analysis Test ---');
    try {
        const result = await runDocumentAnalysis(
            "Analyze the solar energy trends in these documents.",
            [], // selectedDocIds
            [{ originalname: 'Test_Doc.txt', buffer: Buffer.from('Solar energy is growing and becoming more efficient every year in the USA and China. Market leaders like Tesla and BYD are expanding. Costs have dropped by 80% since 2010.'), mimetype: 'text/plain' }],
            mockUser,
            null // projectId
        );

        console.log('\n--- Analysis Result ---');
        console.log('Is Analysis Request:', result.isAnalysisRequest);

        if (result.analysisReport) {
            console.log('Engine Used:', result.analysisReport._meta?.engine);
            console.log('Summary Short:', result.analysisReport.executiveSummary?.short);
            console.log('Insights Count:', (result.analysisReport.insights || []).length);

            if (result.analysisReport._meta?.engine === 'local-nlp') {
                console.warn('\n>>> WARNING: Fell back to local-nlp!');
            } else {
                console.log('\n>>> SUCCESS: Gemini engine was used.');
            }
        } else {
            console.error('ERROR: No analysis report returned!');
        }

    } catch (err) {
        console.error('CRITICAL ERROR in test script:', err);
    }
}

testAnalysis();
