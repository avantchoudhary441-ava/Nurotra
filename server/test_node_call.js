const { spawn } = require('child_process');
const path = require('path');

const callPythonAnalysisEngine = async (documents, prompt, analysisType) => {
    return new Promise((resolve, reject) => {
        const pythonPath = 'python';
        const scriptPath = path.join(__dirname, 'services', 'python', 'analysis_orchestrator.py');

        const payload = JSON.stringify({ documents, prompt, analysisType });
        const pyProcess = spawn(pythonPath, [scriptPath]);

        let output = '';
        let errorOutput = '';

        pyProcess.stdin.write(payload);
        pyProcess.stdin.end();

        pyProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pyProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pyProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Python process failed with code ${code}: ${errorOutput}`));
            }
            try {
                const result = JSON.parse(output);
                resolve(result);
            } catch (err) {
                console.log("RAW OUTPUT ON ERROR:", output);
                reject(new Error('Failed to parse Python analysis output'));
            }
        });
    });
};

async function runTest() {
    const docs = [
        { name: 'test.csv', content: 'A,B\n1,2', type: 'spreadsheet' }
    ];
    const prompt = "test prompt";

    try {
        console.log("Calling Python Engine...");
        const result = await callPythonAnalysisEngine(docs, prompt, 'DEFAULT');
        console.log("SUCCESS! Received result with keys:", Object.keys(result));
        console.log("Processed Docs count:", result.processed_docs.length);
    } catch (e) {
        console.error("TEST FAILED:", e.message);
    }
}

runTest();
