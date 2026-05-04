/**
 * Command Extraction Service
 * Extracts actionable instructions/commands from uploaded files and images.
 *
 * Supports:
 *  - Images (PNG/JPG/WEBP/GIF): Gemini Vision API for reading text/diagrams
 *  - PDFs: text extraction via pdfjs-dist/parsePDF
 *  - DOCX/DOC: text extraction via mammoth/parseDOCX
 *  - Plain text, CSV, Markdown: direct read
 *  - Excel: ExcelJS row extraction
 *
 * Falls back gracefully if Gemini Vision is unavailable.
 */

const ExcelJS = require('exceljs');
const { parsePDF, parseDOCX, parseText } = require('../utils/documentParser');
const aiService = require('./aiService');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

// Keys are now handled centrally in aiService.js

/** Determine MIME type from filename */
const getMimeFromName = (name = '') => {
    const n = name.toLowerCase();
    if (n.endsWith('.pdf')) return 'application/pdf';
    if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (n.endsWith('.doc')) return 'application/msword';
    if (n.endsWith('.xlsx') || n.endsWith('.xls')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
    if (n.endsWith('.gif')) return 'image/gif';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.csv')) return 'text/csv';
    if (n.endsWith('.md')) return 'text/markdown';
    return 'text/plain';
};

const isImage = (mime) => mime.startsWith('image/');
const isDocument = (mime) =>
    mime.includes('pdf') || mime.includes('word') || mime.includes('document');
const isSpreadsheet = (mime) =>
    mime.includes('sheet') || mime.includes('excel') || mime.includes('csv');

// ─────────────────────────────────────────────────────────────
// GEMINI VISION — extract text/commands from image
// ─────────────────────────────────────────────────────────────
/**
 * Centralized AI Call — extract text/commands from image
 */
const extractCommandFromImage = async (buffer, mimeType, fileName) => {
    const base64Data = buffer.toString('base64');

    const systemInstruction = `You are an AI that reads images and extracts actionable document creation instructions.
Look at this image carefully and extract:
1. Any visible text, headings, bullet points, table structure, or diagrams
2. If it is a document layout/wireframe: describe the structure to recreate
3. If it is handwritten notes: transcribe the text
4. If it is a screenshot of content: extract the key content/instructions
5. Formulate everything as a clear, actionable instruction for a document creation agent

Output ONLY the extracted command/instruction. Do not add preamble.`;

    try {
        const result = await aiService.generateWithFallback(
            `Extract instructions from file: ${fileName}`,
            systemInstruction,
            [{ mimeType, data: base64Data }]
        );

        if (result) {
            console.log('[CommandExtraction] Image read successful via AI Service');
            return result.trim();
        }
    } catch (err) {
        console.warn(`[CommandExtraction] Vision failed for ${fileName}: ${err.message}`);
    }

    return `[Image "${fileName}" could not be read by OCR. Please describe what you want to create in the text box.]`;
};

// ─────────────────────────────────────────────────────────────
// TEXT DOCUMENT — extract command from document content
// ─────────────────────────────────────────────────────────────
/**
 * Centralized AI Call — extract actionable command from document text
 */
const extractActionableCommandWithLLM = async (text, fileName) => {
    const systemInstruction = `You are the Nurotra Intelligence Layer. 
Extract the most important actionable instructions/commands from the following document content. 
If the document contains a list of tasks, return them as a clear request for the document agent.
If it is a reference document, summarize the key points as building blocks.
Output ONLY the final actionable instruction. No preamble.`;

    const prompt = `Document Name: ${fileName}\nContent:\n${text.substring(0, 15000)}`;

    try {
        const result = await aiService.generateWithFallback(prompt, systemInstruction);
        return result || null;
    } catch (err) {
        console.warn(`[CommandExtraction] LLM fallback failed for ${fileName}: ${err.message}`);
        return null;
    }
};

const extractCommandFromDocument = async (buffer, mimeType, fileName) => {
    let rawText = '';

    try {
        if (mimeType.includes('pdf')) {
            rawText = await parsePDF(buffer);
        } else if (mimeType.includes('word') || mimeType.includes('document')) {
            rawText = await parseDOCX(buffer);
        } else if (isSpreadsheet(mimeType) || fileName.endsWith('.xlsx')) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const lines = [];
            workbook.eachSheet(sheet => {
                lines.push(`[Sheet: ${sheet.name}]`);
                sheet.eachRow(row => {
                    const vals = row.values
                        .filter(v => v !== null && v !== undefined)
                        .map(v => (typeof v === 'object' && v.text ? v.text : String(v)));
                    if (vals.length) lines.push(vals.join(' | '));
                });
            });
            rawText = lines.join('\n');
        } else {
            rawText = await parseText(buffer);
        }
    } catch (e) {
        console.error('[CommandExtraction] Parse error:', e.message);
        rawText = buffer.toString('utf8').substring(0, 3000);
    }

    if (!rawText || rawText.trim().length < 10) {
        return `The uploaded file "${fileName}" appears to be empty or could not be read. Please check the file.`;
    }

    // --- LLM ENHANCEMENT ---
    const llmCommand = await extractActionableCommandWithLLM(rawText, fileName);
    if (llmCommand) return llmCommand;

    // Fallback to rule-based if LLM fails
    const trimmed = rawText.substring(0, 4000).trim();
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    const wordCount = trimmed.split(/\s+/).length;
    const instructionKeywords = /\b(create|write|make|generate|draft|build|design|include|add|list|provide|summarize|analyze|compare|structure|organize)\b/i;
    const hasInstructions = lines.slice(0, 10).some(l => instructionKeywords.test(l));

    if (hasInstructions && wordCount < 500) {
        return `Based on the instructions in "${fileName}":\n\n${trimmed}`;
    }

    return `Using the content from "${fileName}" as the specification:\n\n${trimmed}\n\nPlease create a well-structured document based on the above content and structure.`;
};


// ─────────────────────────────────────────────────────────────
// MAIN ENTRY — extract commands from all uploaded files
// ─────────────────────────────────────────────────────────────

/**
 * Extracts actionable commands from one or more uploaded files.
 * @param {Array} files - Multer file objects with buffer, originalname, mimetype
 * @param {string} userText - Any additional text the user typed alongside the file
 * @returns { extractedCommands: [{fileName, type, command}], combinedCommand: string }
 */
const extractCommandsFromFiles = async (files, userText = '') => {
    const results = [];

    for (const file of files) {
        const name = file.originalname || 'Unknown file';
        const mime = file.mimetype || getMimeFromName(name);
        const effectiveMime = mime === 'application/octet-stream' ? getMimeFromName(name) : mime;

        console.log('[CommandExtraction] Processing:', name, '| MIME:', effectiveMime);

        let command = '';
        let fileType = 'document';

        try {
            if (isImage(effectiveMime)) {
                fileType = 'image';
                command = await extractCommandFromImage(file.buffer, effectiveMime, name);
            } else {
                fileType = isSpreadsheet(effectiveMime) ? 'spreadsheet' : 'document';
                command = await extractCommandFromDocument(file.buffer, effectiveMime, name);
            }
        } catch (e) {
            console.error('[CommandExtraction] Failed for', name, e.message);
            command = `[Could not process "${name}": ${e.message}]`;
        }

        results.push({ fileName: name, type: fileType, command });
    }

    // Combine all extracted commands + any user text
    let combinedCommand = '';

    if (results.length === 1) {
        combinedCommand = results[0].command;
    } else if (results.length > 1) {
        combinedCommand = results
            .map((r, i) => `File ${i + 1} — ${r.fileName}:\n${r.command}`)
            .join('\n\n---\n\n');
    }

    // Prepend any typed text from the user
    if (userText.trim()) {
        combinedCommand = userText.trim() + '\n\nAdditional context from uploaded file(s):\n' + combinedCommand;
    }

    return {
        extractedCommands: results,
        combinedCommand: combinedCommand.trim()
    };
};

module.exports = {
    extractCommandsFromFiles
};
