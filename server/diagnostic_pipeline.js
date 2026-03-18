require('dotenv').config();
const docsAgentController = require('./controllers/docsAgentController');
const fs = require('fs');
const path = require('path');

// Mock Request and Response
const mockReq = {
    body: {
        prompt: "Create a 7-page document summarizing this novel.",
        history: "[]",
        docIds: "[]",
        links: "[]"
    },
    files: [
        {
            originalname: 'mock_novel.pdf',
            mimetype: 'application/pdf',
            buffer: Buffer.alloc(15 * 1024 * 1024, 'a') // 15MB mock PDF
        }
    ],
    user: { _id: '69459adc39afdc269c7cec1d' }
};

const mockRes = {
    status: function(code) {
        console.log(`Response Status: ${code}`);
        return this;
    },
    json: function(data) {
        console.log("Response JSON:", JSON.stringify(data, null, 2));
        return this;
    }
};

async function runDiagnostic() {
    console.log("Starting DOCS Agent Pipeline Diagnostic...");
    try {
        await docsAgentController.processQuery(mockReq, mockRes);
        console.log("Diagnostic Completed.");
    } catch (e) {
        console.error("DIAGNOSTIC CRASHED:", e);
    }
}

runDiagnostic();
