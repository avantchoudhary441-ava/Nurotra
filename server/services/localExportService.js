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

/**
 * Robustly fetches an image and returns it as a Base64 string for embedding.
 * Fixes the "Red X" remote path issue in Node.js.
 */
const fetchImageAsBase64 = (url) => {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return resolve(null);
            }
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(data);
                resolve(`data:${res.headers['content-type']};base64,${buffer.toString('base64')}`);
            });
        }).on('error', (err) => {
            console.error("Image Fetch Failure:", err.message);
            resolve(null);
        });
    });
};

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
        'Modern': { color: '1A1A1A', accent: '00D2D3', font: 'Montserrat', bg: 'FFFFFF', altBg: 'F5F6FA', headingFont: 'Montserrat', bodyFont: 'Open Sans' },
        'Corporate': { color: '2D3436', accent: '0984E3', font: 'Helvetica', bg: 'FFFFFF', altBg: 'ECF0F1', headingFont: 'Helvetica-Bold', bodyFont: 'Helvetica' },
        'Dark': { color: 'FFFFFF', accent: '00CEC9', font: 'Montserrat', bg: '1E272E', altBg: '2D3436', headingFont: 'Montserrat', bodyFont: 'Open Sans' },
        'Creative': { color: '2D3436', accent: '6C5CE7', font: 'Montserrat', bg: 'FFFFFF', altBg: 'F8F9FA', headingFont: 'Montserrat', bodyFont: 'Montserrat' },
        'Luxury': { color: 'D4AF37', accent: 'D4AF37', font: 'Playfair Display', bg: '1A1A1A', altBg: '2D3436', headingFont: 'Playfair Display', bodyFont: 'Lora' },
        'Vibrant': { color: 'FFFFFF', accent: 'FF007F', font: 'Montserrat', bg: '4834D4', altBg: '686DE0', headingFont: 'Montserrat', bodyFont: 'Open Sans' }
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

    // 0. SET MASTER SLIDE (Branding)
    pres.defineSlideMaster({
        title: "MASTER_SLIDE",
        background: bgGradient
            ? { fill: bg, type: 'gradient', color: bg, rot: 90, stop: bgGradient }
            : { fill: bg },
        objects: [
            { rect: { x: 0, y: 0, w: 0.1, h: '100%', fill: { color: accent } } },
            { text: { text: "Nurotra Intelligence Suite", options: { x: 7.5, y: 7.1, w: 2.0, fontSize: 10, color: accent, italic: true, align: 'right' } } }
        ]
    });

    if (data.slides) {
        for (const s of data.slides) {
            const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
            const layout = s.layoutType || 'BULLETS';
            const contrastTextColor = getContrastColor('#' + bg);
            const contrastAccentColor = getContrastColor('#' + accent);

            // 1. HELPERS FOR DYNAMIC COMPONENTS (With Precision Guard)
            const SAFE_MARGIN = 0.5;
            const MAX_W = 9.0;
            const MAX_H = 5.5;

            const addTitle = (titleText, opts = {}) => {
                const titleColor = getContrastColor('#' + bg);
                // Force title to be accent unless it's too close to background
                const finalColor = (titleColor === '#FFFFFF' && accent === 'FFFFFF') ? '00D2D3' : accent;

                slide.addText(String(titleText || "Slide"), {
                    x: opts.x || SAFE_MARGIN, y: opts.y || 0.4, w: opts.w || '90%', h: opts.h || 0.8,
                    fontSize: opts.fontSize || 36, bold: true, color: finalColor,
                    fontFace: theme.headingFont, align: opts.align || 'left', valign: 'top'
                });
                if (!opts.noUnderline) {
                    slide.addShape(pres.ShapeType.rect, {
                        x: opts.x || SAFE_MARGIN, y: (opts.y || 0.4) + 0.7,
                        w: 3.0, h: 0.05, fill: { color: finalColor, alpha: 40 }
                    });
                }
            };

            const addText = (textValue, opts = {}) => {
                // CONTRAST GUARD: Ensure text is always readable against the slide BG
                const finalTextColor = getContrastColor('#' + bg).replace('#', '');

                const options = {
                    x: opts.x || SAFE_MARGIN, y: opts.y || 1.5, w: opts.w || '90%', h: opts.h || 5.0,
                    fontSize: opts.fontSize || 18, color: finalTextColor,
                    fontFace: theme.bodyFont, lineSpacing: 32, valign: 'top',
                    ...opts.animation ? { animate: opts.animation } : {}
                };
                if (Array.isArray(textValue)) {
                    slide.addText(textValue.map(b => ({ text: String(b), options: { bullet: true, margin: 15, indent: 20 } })), options);
                } else {
                    slide.addText(String(textValue), options);
                }
            };

            // 2. LIVE IMAGE FETCHING (Integrated with Base64 Fallback)
            const imgQuery = s.imageQuery || s.imageHint || "";
            if (imgQuery) {
                const stockUrl = `https://loremflickr.com/1280/720/${encodeURIComponent(imgQuery.split(' ')[0])}`;
                try {
                    const base64Data = await fetchImageAsBase64(stockUrl);
                    if (base64Data) {
                        slide.addImage({ data: base64Data, x: 0, y: 0, w: '100%', h: '100%', opacity: 15 });
                    }
                } catch (e) {
                    console.error("Async Image Fetch Error:", e.message);
                }
            }

            // 3. NATIVE CHART ENGINE (Flexible Integration)
            if (s.chart_config) {
                const c = s.chart_config;
                const chartTypes = {
                    'bar': pres.ChartType.bar,
                    'line': pres.ChartType.line,
                    'pie': pres.ChartType.pie,
                    'area': pres.ChartType.area
                };
                slide.addChart(chartTypes[c.type] || pres.ChartType.bar, c.data, {
                    x: c.x || 0.5, y: c.y || 1.5, w: c.w || 9, h: c.h || 5,
                    title: c.title, showTitle: true,
                    chartColors: [accent, '555555', '999999'],
                    legendPos: 'b'
                });
            }

            // 4. LAYOUT SUITE OVERHAUL
            switch (layout) {
                case 'TITLE_COVER':
                    // High-quality centered layout with safe margins
                    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: 'FFFFFF' });
                    slide.addShape(pres.ShapeType.rect, { x: 0, y: '45%', w: '100%', h: 0.1, fill: accent });

                    slide.addText(String(s.title || "PRESENTATION").toUpperCase(), {
                        x: 0, y: '30%', w: '100%',
                        fontSize: 48, bold: true, color: accent,
                        fontFace: theme.headingFont, align: 'center', valign: 'middle'
                    });

                    slide.addText("NUROTRA INTELLIGENCE SUITE", {
                        x: 0, y: '50%', w: '100%', fontSize: 14, color: '666666', fontFace: theme.bodyFont, align: 'center', spacing: 2
                    });
                    break;

                case 'THREE_COLUMNS':
                    addTitle(s.title);
                    if (s.threeColumns) {
                        const colW = 2.8;
                        const colH = 4.2;
                        const startY = 1.6;
                        s.threeColumns.slice(0, 3).forEach((col, idx) => {
                            const x = SAFE_MARGIN + (idx * 3.1);
                            slide.addShape(pres.ShapeType.rect, {
                                x: x, y: startY, w: colW, h: colH, fill: 'FFFFFF', line: { color: accent, width: 1 }
                            });
                            slide.addText(String(col.title || ""), {
                                x: x + 0.1, y: startY + 0.2, w: colW - 0.2, fontSize: 16, bold: true, color: accent, align: 'center', fontFace: theme.headingFont
                            });
                            slide.addText(String(col.text || ""), {
                                x: x + 0.1, y: startY + 0.7, w: colW - 0.2, fontSize: 13, color: '333333', align: 'center', fontFace: theme.bodyFont
                            });
                        });
                    }
                    break;

                case 'QUADRANT':
                    addTitle(s.title, { align: 'center' });
                    const quadrantLabels = s.quadrant_labels || ["Strength", "Weakness", "Projected", "Risk"];
                    [0, 1, 2, 3].forEach(idx => {
                        const row = Math.floor(idx / 2);
                        const col = idx % 2;
                        const x = SAFE_MARGIN + 0.5 + (col * 4.0);
                        const y = 1.6 + (row * 2.5);
                        slide.addShape(pres.ShapeType.rect, { x, y, w: 3.8, h: 2.3, fill: 'FFFFFF', line: { color: accent, width: 1 } });
                        slide.addText(quadrantLabels[idx], { x: x + 0.2, y: y + 0.1, w: 3.4, fontSize: 16, bold: true, color: accent, fontFace: theme.headingFont });
                        if (s.bullets && s.bullets[idx]) {
                            slide.addText(String(s.bullets[idx]), { x: x + 0.2, y: y + 0.6, w: 3.4, fontSize: 14, color: '333333', fontFace: theme.bodyFont });
                        }
                    });
                    break;

                case 'TIMELINE':
                    addTitle(s.title);
                    const steps = s.timeline_steps || s.bullets || [];
                    slide.addShape(pres.ShapeType.line, { x: SAFE_MARGIN, y: 4.0, w: 9.0, h: 0, line: { color: accent, width: 3 } });
                    steps.slice(0, 5).forEach((step, idx) => {
                        const x = SAFE_MARGIN + (idx * 1.8);
                        slide.addShape(pres.ShapeType.ellipse, { x: x + 0.7, y: 3.8, w: 0.4, h: 0.4, fill: accent });
                        slide.addText(String(step), { x: x, y: idx % 2 === 0 ? 3.0 : 4.5, w: 1.8, fontSize: 12, color: getContrastColor('#' + bg).replace('#', ''), align: 'center', fontFace: theme.bodyFont });
                    });
                    break;

                case 'DATA_GRID':
                    addTitle(s.title);
                    if (s.dataGrid) {
                        s.dataGrid.slice(0, 8).forEach((item, idx) => {
                            const row = Math.floor(idx / 4);
                            const col = idx % 4;
                            const x = SAFE_MARGIN + (col * 2.3);
                            const y = 1.6 + (row * 2.1);
                            slide.addShape(pres.ShapeType.rect, { x, y, w: 2.1, h: 1.8, fill: 'FFFFFF', line: { color: 'EEEEEE' } });
                            slide.addText(String(item.label || ""), { x: x + 0.1, y: y + 0.2, w: 1.9, fontSize: 11, bold: true, color: accent, fontFace: theme.headingFont, align: 'center' });
                            slide.addText(String(item.value || ""), { x: x + 0.1, y: y + 0.7, w: 1.9, fontSize: 22, bold: true, color: '1A1A1A', fontFace: theme.bodyFont, align: 'center' });
                        });
                    }
                    break;

                case 'IMAGE_SPLIT':
                    const splitPos = s.splitRatio || 50; // percentage
                    const imgOnLeft = s.imageSide !== 'right';
                    const textX = imgOnLeft ? (splitPos + 5) / 10 + '%' : '5%';
                    const textW = (100 - splitPos - 10) + '%';
                    const imgX = imgOnLeft ? 0 : (100 - splitPos) / 10;

                    if (s.image_url) {
                        try {
                            const base64Data = await fetchImageAsBase64(s.image_url);
                            if (base64Data) {
                                slide.addImage({ data: base64Data, x: imgX, y: 0, w: splitPos / 10, h: '100%' });
                            }
                        } catch (e) {
                            console.error("Async Image Split Error:", e.message);
                        }
                    }
                    slide.addText(String(s.title || ""), { x: textX, y: '20%', w: textW, fontSize: 32, bold: true, color: accent, fontFace: theme.headingFont });
                    addText(s.bullets || s.text || "", { x: textX, y: '35%', w: textW });
                    break;

                case 'SWOT':
                    addTitle("SWOT Analysis", { align: 'center' });
                    const swot = ["STRENGTHS", "WEAKNESSES", "OPPORTUNITIES", "THREATS"];
                    const swotColors = [accent, 'E74C3C', '2ECC71', 'F1C40F'];
                    swot.forEach((lab, i) => {
                        const x = 0.5 + (i % 2) * 4.5;
                        const y = 1.5 + Math.floor(i / 2) * 2.8;
                        slide.addShape(pres.ShapeType.rect, { x, y, w: 4.3, h: 2.5, fill: 'FFFFFF', line: { color: swotColors[i], width: 2 } });
                        slide.addText(lab, { x: x + 0.2, y: y + 0.1, w: 3.9, fontSize: 20, bold: true, color: swotColors[i], fontFace: theme.headingFont });
                        if (s.bullets && s.bullets[i]) {
                            addText(s.bullets[i], { x: x + 0.2, y: y + 0.6, w: 3.9, fontSize: 14 });
                        }
                    });
                    break;

            }
        }
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
