const { runDocumentAnalysis } = require('./server/services/documentAnalysisService');
require('dotenv').config({ path: './server/.env' });

const mockUser = { _id: '64f1a2b3c4d5e6f7a8b9c0d1', name: 'Test User' };
const mockDocs = [
    { name: 'Test Doc 1.docx', content: 'This is a test document about solar energy. Solar panels are efficient.', source: 'upload' }
];

async function testAnalysis() {
    console.log('--- Starting Analysis Test ---');
    try {
        const result = await runDocumentAnalysis(
            "Analyze the solar energy trends in these documents.",
            [], // selectedDocIds
            [{ originalname: 'Test Doc 1.docx', buffer: Buffer.from('Solar energy is growing.'), mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }],
            mockUser,
            null // projectId
        );

        console.log('--- Analysis Result ---');
        console.log('Intent:', result.isAnalysisRequest);
        console.log('Engine Used:', result.analysisReport?._meta?.engine);
        console.log('Summary:', result.analysisReport?.executiveSummary?.short);

        if (result.analysisReport?._meta?.engine === 'local-nlp') {
            console.warn('WARNING: Fell back to local-nlp!');
        } else {
            console.log('SUCCESS: Gemini engine was used.');
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    }
}

testAnalysis();
