const { runDocumentAnalysis } = require('./services/documentAnalysisService');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Mock User
const mockUser = { _id: new mongoose.Types.ObjectId() };

async function testIntegration() {
    console.log('--- Testing Node.js + Python Integration ---');

    const prompt = "Perform a complete analysis of these documents and tell me the trends.";
    const uploadedFiles = [
        {
            originalname: 'ev_data.csv',
            mimetype: 'text/csv',
            buffer: Buffer.from('Year,Sales,Company\n2018,100,Tesla\n2019,200,Tesla\n2020,400,Tesla\n2021,800,BYD')
        },
        {
            originalname: 'market_update.txt',
            mimetype: 'text/plain',
            buffer: Buffer.from('Elon Musk announced expansion in Germany. Battery costs are falling.')
        }
    ];

    try {
        // We need to semi-mock the DB and AI service if we don't want to hit real ones
        // But let's see if we can run it. documentAnalysisService uses generateWithFallback.

        const result = await runDocumentAnalysis(prompt, [], uploadedFiles, mockUser);

        console.log('Analysis Request:', result.isAnalysisRequest);
        if (result.analysisReport) {
            console.log('Engine Used:', result.analysisReport._meta.engine);
            console.log('Docs Analyzed:', result.analysisReport._meta.docsAnalyzed.length);
            console.log('Entities (Organizations):', result.analysisReport.entities.organizations);
            console.log('Python Insights Found:', !!result.analysisReport.pythonInsights);
            if (result.analysisReport.pythonInsights) {
                console.log('Trend Example:', result.analysisReport.pythonInsights[0].insights.trends);
            }
        }
    } catch (err) {
        console.error('Integration Test Failed:', err.message);
    }
}

// Since we use Mongoose models, we might need a connection or mock them
// For a quick check, let's just try running.
testIntegration();
