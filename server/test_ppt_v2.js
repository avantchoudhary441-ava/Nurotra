const localExportService = require('./services/localExportService');
const path = require('path');

async function verifyV2() {
    console.log("Starting PPT V2 Verification (Production Flow)...");

    const v2Data = {
        name: "V2_Verification_Final",
        type: "ppt", // This triggers PPTX generation
        data: {
            fileName: "V2_Verification_Final.pptx",
            theme: "Dark",
            accentColor: "00CEC9",
            backgroundColor: "1E272E",
            slides: [
                {
                    title: "V2 Precision Alignment",
                    layoutType: "THREE_COLUMNS",
                    threeColumns: [
                        { title: "Box Contrast Guard", text: "This box is white with dark text, ensuring 100% legibility regardless of slide background. This is a detailed description to test spacing and padding." },
                        { title: "Safe Margin Grid", text: "Notice how this text does not touch the edges. It respects the 0.5 safe margin grid implemented in the V2 engine overhaul." },
                        { title: "Responsive Layout", text: "Column widths are now calculated precisely to prevent overlapping and ensure a professional agency-quality look." }
                    ]
                },
                {
                    title: "DATA_GRID Optimization",
                    layoutType: "DATA_GRID",
                    dataGrid: [
                        { label: "Metric Stability", value: "High" },
                        { label: "Contrast Ratio", value: "V2 Pass" },
                        { label: "Grid Spacing", value: "0.5 Unit" },
                        { label: "Box Shadow", value: "3px Blur" }
                    ]
                }
            ]
        }
    };

    try {
        const result = await localExportService.automateLocalSave(v2Data.data, "VerificationProject", "SystemTest", "pptx");
        console.log("PPT V2 generated successfully at:", result.path);
        console.log("SUCCESS: Production entry point validated flow.");
    } catch (err) {
        console.error("V2 Verification Failed:", err.message);
    }
}

verifyV2();
