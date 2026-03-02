const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, UnderlineType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    LevelFormat, convertInchesToTwip,
    Header, Footer, SimpleField,
    PageBreak, ShadingType,
    ImageRun
} = require("docx");
const https = require("https");
const http = require("http");
const pptxgen = require("pptxgenjs");
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Use a dynamic base path relative to the project root
const WORKSPACE_BASE = path.resolve(process.cwd(), "..", "nurotra workplace");

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

const ensureDirectory = (userName, projectName) => {
    if (!fs.existsSync(WORKSPACE_BASE)) fs.mkdirSync(WORKSPACE_BASE, { recursive: true });
    const safeUserName = String(userName || "Guest").replace(/[^a-z0-9]/gi, '_');
    const userPath = path.join(WORKSPACE_BASE, safeUserName);
    if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });
    const safeProjectName = String(projectName || "Standalone").replace(/[^a-z0-9]/gi, '_');
    const projectPath = path.join(userPath, safeProjectName);
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    return projectPath;
};

const rescueToFormat = (docData, targetExt) => {
    const { rawStructure, type, content } = docData;
    let rescued = rawStructure ? JSON.parse(JSON.stringify(rawStructure)) : {};

    // Ensure basic structure for Word
    if (targetExt === '.docx') {
        if (!rescued.sections || !Array.isArray(rescued.sections)) {
            rescued.sections = [{
                heading: String(rescued.title || docData.name || "Document"),
                level: 1,
                content: String(content || "")
            }];
        }
    }

    // Ensure basic structure for Excel
    if (targetExt === '.xlsx' && (!rescued.sheets || rescued.sheets.length === 0)) {
        rescued.sheets = [{
            name: "Sheet 1",
            rows: content ? String(content).split('\n').map(l => [l]) : [["No content"]]
        }];
    }

    // Ensure basic structure for PPT
    if (targetExt === '.pptx' && (!rescued.slides || rescued.slides.length === 0)) {
        rescued.slides = [{
            title: String(rescued.title || "Slide"),
            bullets: content ? String(content).split('\n').filter(l => l.trim()).slice(0, 5) : ["Generated Slide"]
        }];
    }

    return rescued;
};

const fetchImageBuffer = (url) => new Promise((resolve) => {
    if (!url) return resolve(null);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
});

// ==========================================
// CORE SAVING LOGIC
// ==========================================

const saveWord = async (data, fullPath, safeWriteBuffer) => {
    const { title, sections, header, footer } = data;
    const docChildren = [];

    // Title
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

    const buffer = await Packer.toBuffer(doc);
    return safeWriteBuffer(buffer, fullPath);
};

const saveExcel = async (data, fullPath, safeWriteBuffer) => {
    const workbook = new ExcelJS.Workbook();
    const sheets = data.sheets || [{ name: 'Sheet 1', rows: [["No content"]] }];
    sheets.forEach(s => {
        const sheet = workbook.addWorksheet(String(s.name || 'Sheet').substring(0, 31));
        if (s.rows) s.rows.forEach(r => sheet.addRow(Array.isArray(r) ? r : [String(r)]));
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return safeWriteBuffer(buffer, fullPath);
};

const savePPT = async (data, fullPath, safeWriteBuffer) => {
    const pres = new pptxgen();
    if (data.slides) {
        data.slides.forEach(s => {
            const slide = pres.addSlide();
            slide.addText(String(s.title || "Slide"), { x: 0.5, y: 0.5, fontSize: 24, bold: true });
            if (s.bullets) slide.addText(s.bullets.join('\n'), { x: 0.5, y: 1.5, fontSize: 18, bullet: true });
        });
    }
    const buffer = await pres.write('nodebuffer');
    return safeWriteBuffer(buffer, fullPath);
};

const automateLocalSave = async (docData, projectName, userName, formatOverride) => {
    const sName = String(docData.name || "Untitled");
    const saveDir = ensureDirectory(userName, projectName);
    const type = docData.type || 'docx';
    const finalFormat = formatOverride || (type === 'excel' ? 'xlsx' : type === 'ppt' ? 'pptx' : 'docx');
    const ext = finalFormat.startsWith('.') ? finalFormat : '.' + finalFormat;

    const baseName = sName.replace(/[<>:"/\\|?*]/g, '_').trim() || "Document";
    const fullPath = path.join(saveDir, `${baseName}${ext}`);

    const safeWriteBuffer = (buffer, targetPath) => {
        const tmpPath = targetPath + `.tmp_${Date.now()}`;
        fs.writeFileSync(tmpPath, buffer);
        try {
            if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
            fs.renameSync(tmpPath, targetPath);
            return targetPath;
        } catch (e) {
            const versioned = targetPath.replace(ext, `_${Date.now()}${ext}`);
            fs.renameSync(tmpPath, versioned);
            return versioned;
        }
    };

    const structure = rescueToFormat(docData, ext);
    if (ext === '.xlsx') return { success: true, path: await saveExcel(structure, fullPath, safeWriteBuffer) };
    if (ext === '.pptx') return { success: true, path: await savePPT(structure, fullPath, safeWriteBuffer) };
    return { success: true, path: await saveWord(structure, fullPath, safeWriteBuffer) };
};

const openWorkspace = (projectName, userName) => {
    const projectPath = ensureDirectory(userName, projectName);
    return new Promise((r, j) => {
        exec(`start "" "${projectPath}"`, (err) => err ? j(err) : r({ success: true, path: projectPath }));
    });
};

module.exports = { automateLocalSave, openWorkspace };
