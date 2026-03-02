const { automateLocalSave } = require('./services/localExportService');
const fs = require('fs');
const path = require('path');

async function testFixes() {
    console.log("Starting final verification of 500 error fixes...");

    // Test CASE 1: Invalid characters and missing rawStructure
    const mockDoc1 = {
        name: "Invalid:*Name?/Test",
        type: "docx",
        content: "This document has an invalid name and missing rawStructure.",
        // missing rawStructure completely
    };

    console.log("\n[Test 1] Saving document with invalid characters and missing structure...");
    try {
        const result1 = await automateLocalSave(mockDoc1, "DebugProject", "Anuj");
        console.log("Result 1:", result1.success ? "SUCCESS" : "FAILED", "-", result1.path);
        if (result1.path.includes("Invalid__Name__Test")) {
            console.log("Verification: Filename sanitized correctly.");
        }
    } catch (err) {
        console.error("Test 1 FAILED with error:", err.message);
    }

    // Test CASE 2: Excel with missing structure (triggering rescueToFormat)
    const mockDoc2 = {
        name: "ExcelFallback",
        type: "excel",
        content: "| Header 1 | Header 2 |\n|---|---|\n| Data 1 | Data 2 |",
        rawStructure: { sections: [{ heading: "Data Section", content: "| Row 1 | Row 2 |" }] }
    };

    console.log("\n[Test 2] Saving Excel with rescueToFormat logic...");
    try {
        const result2 = await automateLocalSave(mockDoc2, "DebugProject", "Anuj", "xlsx");
        console.log("Result 2:", result2.success ? "SUCCESS" : "FAILED", "-", result2.path);
    } catch (err) {
        console.error("Test 2 FAILED with error:", err.message);
    }

    // Test CASE 3: Completely empty document data
    const mockDoc3 = {
        name: null,
        type: null,
        content: null,
        rawStructure: null
    };

    console.log("\n[Test 3] Saving completely empty document...");
    try {
        const result3 = await automateLocalSave(mockDoc3, "EmptyProject", "Guest");
        console.log("Result 3:", result3.success ? "SUCCESS" : "FAILED", "-", result3.path);
    } catch (err) {
        console.error("Test 3 FAILED with error:", err.message);
    }

    console.log("\nAll tests attempted.");
}

testFixes();
