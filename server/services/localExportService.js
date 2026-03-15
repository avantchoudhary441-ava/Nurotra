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

const getLuminance = (hex) => {
    const rgb = hex.replace('#', '');
    const r = parseInt(rgb.substring(0, 2), 16);
    const g = parseInt(rgb.substring(2, 4), 16);
    const b = parseInt(rgb.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const getContrastColor = (hex) => getLuminance(hex) > 0.6 ? '333333' : 'FFFFFF';

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

const getPPTTheme = (themeName) => {
    const themes = {
        'Modern': { color: '1A1A1A', accent: '00D2D3', font: 'Montserrat', bg: 'FFFFFF', altBg: 'F5F6FA' },
        'Corporate': { color: '2D3436', accent: '0984E3', font: 'Helvetica', bg: 'FFFFFF', altBg: 'ECF0F1' },
        'Dark': { color: 'FFFFFF', accent: '00CEC9', font: 'Open Sans', bg: '2D3436', altBg: '1E272E' },
        'Creative': { color: '2D3436', accent: '6C5CE7', font: 'Montserrat', bg: 'FFFFFF', altBg: 'F8F9FA' },
        'Luxury': { color: 'D4AF37', accent: 'D4AF37', font: 'Garamond', bg: '1A1A1A', altBg: '2D3436' },
        'Vibrant': { color: 'FFFFFF', accent: 'FF007F', font: 'Montserrat', bg: '4834D4', altBg: '686DE0' }
    };
    return themes[themeName] || themes['Modern'];
};

const savePPT = async (data, fullPath, safeWriteBuffer) => {
    const pres = new pptxgen();
    const theme = getPPTTheme(data.theme);
    const accent = (data.accentColor || theme.accent).replace('#', '');
    const bg = (data.backgroundColor || theme.bg).replace('#', '');
    const bgGradient = data.bgGradient ? data.bgGradient.replace('#', '') : null;
    const font = data.fontFace || theme.font;

    if (data.slides) {
        data.slides.forEach(s => {
            const slide = pres.addSlide();

            // 1. DYNAMIC BACKGROUND ENGINE
            if (bgGradient) {
                slide.background = { fill: bg, type: 'gradient', color: bg, rot: 90, stop: bgGradient };
            } else {
                slide.background = { fill: bg };
            }

            // Subtle Texture (Geometric Overlay)
            slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: accent, alpha: 5 } });
            slide.addShape(pres.ShapeType.ellipse, { x: -1, y: -1, w: 4, h: 4, fill: { color: accent, alpha: 10 } });

            const layout = s.layoutType || 'BULLETS';
            const contrastTextColor = getContrastColor('#' + bg);
            const contrastAccentColor = getContrastColor('#' + accent);

            // 1.5 LIVE IMAGE FETCHING (Phase 3)
            const imgQuery = s.imageQuery || s.imageHint || "";
            if (imgQuery && (layout.includes('IMAGE') || layout === 'TITLE_COVER' || layout === 'DIAGONAL_SPLIT')) {
                const stockUrl = `https://loremflickr.com/1280/720/${encodeURIComponent(imgQuery.split(' ')[0])}`;
                slide.addImage({ url: stockUrl, x: 0, y: 0, w: '100%', h: '100%', opacity: 20 });
            }

            // 2. LAYOUT ENGINE
            switch (layout) {
                case 'TITLE_COVER':
                    // Background Split
                    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '40%', h: '100%', fill: accent });
                    slide.addShape(pres.ShapeType.rect, { x: '40%', y: 0, w: '60%', h: '100%', fill: bg });

                    slide.addText(String(s.title || "Untitled"), {
                        x: '45%', y: '35%', w: '50%', h: '20%',
                        fontSize: 54, bold: true, color: accent,
                        fontFace: font, align: 'left', valign: 'middle'
                    });
                    slide.addText("PROJECT PROPOSAL", {
                        x: '45%', y: '30%', w: '50%', fontSize: 14, color: contrastTextColor, fontFace: font, italic: true
                    });
                    slide.addShape(pres.ShapeType.rect, { x: '45%', y: '55%', w: 2.0, h: 0.1, fill: accent });
                    break;

                case 'DIAGONAL_SPLIT':
                    // High-impact Diagonal Design
                    slide.addShape(pres.ShapeType.rtTriangle, { x: 0, y: 0, w: '100%', h: '100%', fill: accent, flipH: true });
                    slide.addText(String(s.title || ""), {
                        x: 0.5, y: '70%', w: '90%', fontSize: 44, bold: true, color: 'FFFFFF', fontFace: font
                    });
                    if (s.bullets) {
                        slide.addText(s.bullets[0] || "", { x: 0.5, y: '85%', w: '90%', fontSize: 20, color: 'FFFFFF', fontFace: font, italic: true });
                    }
                    break;

                case 'THREE_COLUMNS':
                    slide.addText(String(s.title || "Key Pillars"), { x: 0.5, y: 0.3, w: '90%', fontSize: 32, bold: true, color: accent, fontFace: font });
                    if (s.threeColumns) {
                        s.threeColumns.slice(0, 3).forEach((col, idx) => {
                            const x = 0.5 + (idx * 3.1);
                            slide.addShape(pres.ShapeType.rect, { x: x, y: 1.5, w: 2.8, h: 4.5, fill: 'FFFFFF', line: { color: accent, width: 1 } });
                            slide.addShape(pres.ShapeType.rect, { x: x, y: 1.5, w: 2.8, h: 0.1, fill: accent });
                            slide.addText(String(col.title || ""), { x: x + 0.1, y: 1.7, w: 2.6, fontSize: 18, bold: true, color: accent, align: 'center', fontFace: font });
                            slide.addText(String(col.text || ""), { x: x + 0.1, y: 2.2, w: 2.6, fontSize: 14, color: contrastTextColor, align: 'center', fontFace: font });
                        });
                    }
                    break;

                case 'DATA_GRID':
                    slide.addText(String(s.title || "Data Analysis"), { x: 0.5, y: 0.3, w: '90%', fontSize: 32, bold: true, color: accent, fontFace: font });
                    if (s.dataGrid) {
                        s.dataGrid.slice(0, 6).forEach((item, idx) => {
                            const row = Math.floor(idx / 3);
                            const col = idx % 3;
                            const x = 0.5 + (col * 3.1);
                            const y = 1.5 + (row * 2.2);
                            slide.addShape(pres.ShapeType.rect, { x: x, y: y, w: 2.8, h: 1.8, fill: 'F8F9FA', line: { color: 'CCCCCC', width: 1 } });
                            slide.addText(String(item.label || ""), { x: x + 0.1, y: y + 0.2, w: 2.6, fontSize: 14, bold: true, color: accent, fontFace: font });
                            slide.addText(String(item.value || ""), { x: x + 0.1, y: y + 0.7, w: 2.6, fontSize: 24, bold: true, color: contrastTextColor, fontFace: font });
                        });
                    }
                    break;

                case 'BIG_FACT':
                    if (s.bigFact) {
                        slide.addText(String(s.bigFact.value || "0%"), {
                            x: 0, y: '30%', w: '100%', h: 1.5,
                            fontSize: 110, bold: true, color: accent,
                            fontFace: font, align: 'center'
                        });
                        slide.addText(String(s.bigFact.label || "Key Metric"), {
                            x: 0, y: '55%', w: '100%', h: 0.5,
                            fontSize: 28, color: contrastTextColor,
                            fontFace: font, align: 'center'
                        });
                    }
                    break;

                case 'PROCESS_FLOW':
                    slide.addText(String(s.title || "Process"), { x: 0.5, y: 0.3, w: '90%', fontSize: 32, bold: true, color: accent, fontFace: font });
                    if (s.processFlow) {
                        s.processFlow.slice(0, 4).forEach((step, idx) => {
                            const x = 0.5 + (idx * 2.3);
                            slide.addShape(pres.ShapeType.roundRect, { x: x, y: 2.5, w: 2.1, h: 2.5, fill: 'FFFFFF', line: { color: accent, width: 2 }, rectRadius: 0.2 });
                            slide.addText(String(step.label || ""), { x: x + 0.1, y: 2.6, w: 1.9, fontSize: 16, bold: true, color: accent, align: 'center', fontFace: font });
                            if (idx < 3) slide.addShape(pres.ShapeType.rightArrow, { x: x + 2.15, y: 3.5, w: 0.3, h: 0.3, fill: accent });
                        });
                    }
                    break;

                case 'INFOGRAPHIC':
                    slide.addText(String(s.title || "Insights"), { x: 0.5, y: 0.3, w: '90%', fontSize: 32, bold: true, color: accent, fontFace: font });
                    if (s.infographic) {
                        slide.addShape(pres.ShapeType.ellipse, { x: 1.0, y: 2.0, w: 3.0, h: 3.0, fill: accent });
                        slide.addText(String(s.infographic.metric || ""), { x: 1.0, y: 2.7, w: 3.0, fontSize: 36, bold: true, color: contrastAccentColor, align: 'center', fontFace: font });
                        slide.addText(String(s.infographic.icon || "Feature"), { x: 5.0, y: 2.5, w: 4.0, fontSize: 24, italic: true, color: contrastTextColor, fontFace: font });
                    }
                    break;

                case 'COMPARISON':
                    slide.addText(String(s.title || "Comparison"), { x: 0.5, y: 0.3, w: '90%', fontSize: 28, bold: true, color: accent, fontFace: font });
                    slide.addShape(pres.ShapeType.rect, { x: 5.0, y: 1.2, w: 0.02, h: 5.0, fill: 'CCCCCC' });
                    if (s.comparison) {
                        if (s.comparison.left) slide.addText(s.comparison.left.map(b => ({ text: String(b), options: { bullet: true } })), { x: 0.5, y: 1.5, w: 4.2, h: 5.0, fontSize: 18, color: contrastTextColor, fontFace: font, lineSpacing: 32 });
                        if (s.comparison.right) slide.addText(s.comparison.right.map(b => ({ text: String(b), options: { bullet: true } })), { x: 5.3, y: 1.5, w: 4.2, h: 5.0, fontSize: 18, color: contrastTextColor, fontFace: font, lineSpacing: 32 });
                    }
                    break;

                case 'IMAGE_FULL':
                    slide.addText(String(s.title || ""), {
                        x: 0, y: '80%', w: '100%', h: 1.0,
                        fontSize: 40, bold: true, color: 'FFFFFF',
                        fontFace: font, align: 'center', fill: { color: '000000', alpha: 40 }
                    });
                    if (s.imageHint) slide.addText(`[Visual: ${s.imageHint}]`, { x: 0.5, y: 0.5, fontSize: 12, color: accent, italic: true });
                    break;

                default: // BULLETS
                    // Stylish side accent
                    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: '100%', fill: accent });

                    // Title with subtle underline
                    slide.addText(String(s.title || "Slide"), {
                        x: 0.5, y: 0.4, w: '90%', h: 0.6,
                        fontSize: 36, bold: true, color: accent,
                        fontFace: font, align: 'left', valign: 'top'
                    });
                    slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 3.0, h: 0.05, fill: { color: accent, alpha: 30 } });

                    if (s.bullets) {
                        slide.addText(s.bullets.map(b => ({ text: String(b), options: { bullet: true, margin: 15, indent: 20 } })), {
                            x: 0.5, y: 1.5, w: '90%', h: 5.0,
                            fontSize: 20, color: contrastTextColor,
                            fontFace: font, lineSpacing: 36, valign: 'top'
                        });
                    }
                    break;
            }

            // Branding Footer
            slide.addText("Nurotra Executive Suite", { x: 7.5, y: 7.1, w: 2.0, fontSize: 10, color: accent, italic: true, align: 'right' });
        });
    }
    const buffer = await pres.write('nodebuffer');
    return safeWriteBuffer(buffer, fullPath);
};

const automateLocalSave = async (docData, projectName, userName, formatOverride) => {
    // Local directory creation and file saving disabled.
    return { success: true, path: "disabled" };
};

const openWorkspace = (projectName, userName) => {
    return new Promise((resolve) => {
        resolve({ success: true, path: "disabled", message: "Local workspace is disabled." });
    });
};

module.exports = { automateLocalSave, openWorkspace };
