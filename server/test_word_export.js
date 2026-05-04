require('dotenv').config();
const cloudExportService = require('./services/cloudExportService');
const fs = require('fs');
const path = require('path');

async function testWordExport() {
    console.log("Starting Word Export Test with Chart block...");

    const mockDocData = {
        name: "Competitor Analysis Report.docx",
        type: "word",
        title: "Market Analysis",
        rawStructure: {
            title: "Market Analysis",
            sections: [
                {
                    heading: "Competitor Analysis",
                    level: 1,
                    blocks: [
                        { type: "paragraph", text: "The competitive landscape includes several established players with strong brand recognition and customer loyalty. Key competitors include TechCorp, Innovate Solutions, and Digital Dynamics." },
                        {
                            type: "chart",
                            chartType: "pie",
                            title: "Market Share of Key Competitors",
                            description: "Shows the relative market share of the top competitors in the space.",
                            data: [
                                { name: "TechCorp", value: 35 },
                                { name: "Innovate Solutions", value: 25 },
                                { name: "Digital Dynamics", value: 20 },
                                { name: "Others", value: 20 }
                            ]
                        },
                        { type: "subheading", text: "Target Customer Segments", level: 2 },
                        { type: "paragraph", text: "The primary target customer segments include small to medium-sized enterprises (SMEs)." }
                    ]
                }
            ]
        }
    };

    try {
        const result = await cloudExportService.generateBuffer(mockDocData, 'docx');
        console.log(`✅ SUCCESS: Word Buffer Generated! Size: ${result.buffer.length} bytes`);
        console.log(`✅ File Ext: ${result.ext}`);
        console.log(`✅ MIME Type: ${result.mimeType}`);

        // Save to disk temporarily to manually inspect if needed
        const outputPath = path.join(__dirname, 'test_export_output.docx');
        fs.writeFileSync(outputPath, result.buffer);
        console.log(`📝 Wrote test file to: ${outputPath}`);

    } catch (error) {
        console.error("❌ ERROR: Failed to generate Word Buffer:", error);
        process.exit(1);
    }
}

testWordExport();
