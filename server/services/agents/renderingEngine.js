/**
 * Agent 7 — Rendering Engine
 * Orchestrates the final output generation based on the target format.
 */
const { generateWebsite } = require("./websiteGenerator");
const cloudExportService = require("../cloudExportService");

const renderOutput = async (processedData, format) => {
    // Normalize format keys
    const f = (format || 'docx').toLowerCase();

    switch (f) {
        case 'website':
            return await generateWebsite(processedData);
        case 'ppt':
        case 'pptx': {
            // Generate valid PPTX buffer using the cloud service
            const pptResult = await cloudExportService.generateBuffer({
                name: processedData.topic || "Presentation",
                type: 'ppt',
                rawStructure: { slides: processedData.slides }
            }, 'pptx');
            return {
                type: 'ppt',
                buffer: pptResult.buffer,
                fileName: pptResult.fileName,
                mimeType: pptResult.mimeType
            };
        }
        case 'report':
        case 'word':
        case 'doc':
        case 'docx': {
            // Map 'slides' from content generator to 'sections' for the Word engine
            if (processedData.slides && !processedData.sections) {
                processedData.sections = processedData.slides.map(s => ({
                    heading: s.title,
                    level: 1,
                    blocks: s.bullets.map(b => ({ type: 'paragraph', text: b })),
                    image_url: s.image_query ? `https://loremflickr.com/800/600/${encodeURIComponent(s.image_query.split(' ')[0])}` : null
                }));
            }
            const wordResult = await cloudExportService.generateBuffer({
                name: processedData.topic || "Report",
                type: 'docx',
                rawStructure: processedData
            }, 'docx');
            return {
                type: 'word',
                buffer: wordResult.buffer,
                fileName: wordResult.fileName,
                mimeType: wordResult.mimeType
            };
        }
        case 'excel':
        case 'xlsx': {
            const excelResult = await cloudExportService.generateBuffer({
                name: processedData.topic || "Data_Export",
                type: 'excel',
                rawStructure: processedData
            }, 'xlsx');
            return {
                type: 'excel',
                buffer: excelResult.buffer,
                fileName: excelResult.fileName,
                mimeType: excelResult.mimeType
            };
        }
        default:
            return { type: 'text', message: "Generic rendering fallback." };
    }
};

module.exports = { renderOutput };
