/**
 * cloudExportService.js
 * Same Word/Excel/PPT generation logic as localExportService,
 * but returns a Buffer in memory instead of writing to disk.
 */

const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, UnderlineType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    Header, Footer,
    PageBreak, ShadingType
} = require("docx");
const https = require("https");
const http = require("http");
const pptxgen = require("pptxgenjs");
const ExcelJS = require('exceljs');

// ==========================================
// HELPERS
// ==========================================

const parseTextWithPlaceholders = (text, style = {}) => {
    if (!text) return [new TextRun("")];
    const runs = [];
    const parts = String(text).split(/({{[^}]+}})/g);
    parts.forEach(part => {
        if (!part) return;
        const isPlaceholder = /^{{(.+)}}$/.test(part);
        if (isPlaceholder) {
            const innerText = part.replace(/^{{|}}$/g, '');
            runs.push(new TextRun({
                text: `[${innerText}]`,
                highlight: "yellow",
                bold: true,
                font: style.font || "Calibri",
                size: style.fontSize || 24,
            }));
        } else {
            runs.push(new TextRun({
                text: part,
                font: style.font || "Calibri",
                size: style.fontSize || 24,
            }));
        }
    });
    return runs;
};

const getAlignment = (align) => {
    switch ((align || '').toLowerCase()) {
        case 'center': return AlignmentType.CENTER;
        case 'right': return AlignmentType.RIGHT;
        case 'justify': return AlignmentType.JUSTIFIED;
        default: return AlignmentType.LEFT;
    }
};

const getHeadingLevel = (level) => {
    switch (level) {
        case 1: return HeadingLevel.HEADING_1;
        case 2: return HeadingLevel.HEADING_2;
        case 3: return HeadingLevel.HEADING_3;
        default: return HeadingLevel.HEADING_1;
    }
};

const rescueToFormat = (docData, ext) => {
    const { rawStructure, type, content } = docData;
    let rescued = rawStructure ? JSON.parse(JSON.stringify(rawStructure)) : {};

    if (ext === '.docx') {
        if (!rescued.sections || !Array.isArray(rescued.sections)) {
            rescued.sections = [{
                heading: String(rescued.title || docData.name || "Document"),
                level: 1,
                content: String(content || "")
            }];
        }
    }
    if (ext === '.xlsx' && (!rescued.sheets || rescued.sheets.length === 0)) {
        rescued.sheets = [{
            name: "Sheet 1",
            rows: content ? String(content).split('\n').map(l => [l]) : [["No content"]]
        }];
    }
    if (ext === '.pptx' && (!rescued.slides || rescued.slides.length === 0)) {
        rescued.slides = [{
            title: String(rescued.title || "Slide"),
            bullets: content ? String(content).split('\n').filter(l => l.trim()).slice(0, 5) : ["Generated Slide"]
        }];
    }
    return rescued;
};

// ==========================================
// CORE BUFFER GENERATORS (in-memory, no fs)
// ==========================================

const generateWordBuffer = async (data) => {
    const { title, sections, header, footer } = data;
    const docChildren = [];

    docChildren.push(new Paragraph({
        text: String(title || "New Document"),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
    }));

    if (sections) {
        sections.forEach(sec => {
            if (sec.heading) {
                docChildren.push(new Paragraph({
                    text: String(sec.heading),
                    heading: getHeadingLevel(sec.level || 1),
                    spacing: { before: 240, after: 120 }
                }));
            }
            if (sec.blocks && Array.isArray(sec.blocks)) {
                sec.blocks.forEach(block => {
                    try {
                        if (block.type === 'paragraph') {
                            docChildren.push(new Paragraph({
                                children: parseTextWithPlaceholders(String(block.text || "")),
                                spacing: { after: 120 }
                            }));
                        } else if (block.type === 'table' && block.headers && block.rows) {
                            const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
                            const borders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };
                            const headerRow = new TableRow({
                                children: block.headers.map(h => new TableCell({
                                    children: [new Paragraph({ text: String(h), bold: true })],
                                    borders, shading: { fill: "E8E8E8" }
                                }))
                            });
                            const dataRows = block.rows.map(row => new TableRow({
                                children: (Array.isArray(row) ? row : []).map(cell => new TableCell({
                                    children: [new Paragraph({ text: String(cell || "") })],
                                    borders
                                }))
                            }));
                            docChildren.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
                        }
                    } catch (e) { console.warn("Skip block", e.message); }
                });
            } else if (sec.content) {
                String(sec.content).split('\n').filter(p => p.trim()).forEach(p => {
                    docChildren.push(new Paragraph({ text: String(p), spacing: { after: 120 } }));
                });
            }
        });
    }

    const doc = new Document({
        sections: [{
            headers: { default: new Header({ children: [new Paragraph({ text: String(header || ""), alignment: AlignmentType.RIGHT })] }) },
            footers: { default: new Footer({ children: [new Paragraph({ text: String(footer || ""), alignment: AlignmentType.CENTER })] }) },
            children: docChildren,
        }]
    });

    return await Packer.toBuffer(doc);
};

const generateExcelBuffer = async (data) => {
    const workbook = new ExcelJS.Workbook();
    const sheets = data.sheets || [{ name: 'Sheet 1', rows: [["No content"]] }];
    sheets.forEach(s => {
        const sheet = workbook.addWorksheet(String(s.name || 'Sheet').substring(0, 31));
        if (s.rows) s.rows.forEach(r => sheet.addRow(Array.isArray(r) ? r : [String(r)]));
    });
    return await workbook.xlsx.writeBuffer();
};

const generatePPTBuffer = async (data) => {
    const pres = new pptxgen();
    if (data.slides) {
        data.slides.forEach(s => {
            const slide = pres.addSlide();
            slide.addText(String(s.title || "Slide"), { x: 0.5, y: 0.5, fontSize: 24, bold: true });
            if (s.bullets) slide.addText(s.bullets.join('\n'), { x: 0.5, y: 1.5, fontSize: 18, bullet: true });
        });
    }
    return await pres.write('nodebuffer');
};

// ==========================================
// MAIN EXPORT
// ==========================================

/**
 * Generate a file buffer from document data without touching disk.
 * @param {Object} docData - The document object (name, type, content, rawStructure)
 * @param {string} formatOverride - Optional: 'docx', 'xlsx', 'pptx'
 * @returns {{ buffer: Buffer, ext: string, mimeType: string, fileName: string }}
 */
const generateBuffer = async (docData, formatOverride) => {
    const type = docData.type || 'docx';
    const finalFormat = formatOverride || (type === 'excel' ? 'xlsx' : type === 'ppt' ? 'pptx' : 'docx');
    const ext = finalFormat.startsWith('.') ? finalFormat : '.' + finalFormat;

    const mimeMap = {
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };

    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const baseName = String(docData.name || "Document").replace(/[<>:"/\\|?*]/g, '_').trim();
    const fileName = `${baseName}${ext}`;

    const structure = rescueToFormat(docData, ext);

    let buffer;
    if (ext === '.xlsx') buffer = await generateExcelBuffer(structure);
    else if (ext === '.pptx') buffer = await generatePPTBuffer(structure);
    else buffer = await generateWordBuffer(structure);

    return { buffer, ext, mimeType, fileName };
};

module.exports = { generateBuffer };
