/**
 * cloudExportService.js
 * Same Word/Excel/PPT generation logic as localExportService,
 * but returns a Buffer in memory instead of writing to disk.
 */

const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, UnderlineType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    LevelFormat, convertInchesToTwip,
    Header, Footer, PageNumber, NumberFormat,
    PageBreak, ShadingType,
    ImageRun
} = require("docx");
const https = require("https");
const http = require("http");
const pptxgen = require("pptxgenjs");
const ExcelJS = require('exceljs');

// ==========================================
// HELPERS
// ==========================================

// Returns an array of TextRun objects with placeholders highlighted yellow
// Also applies inline bold/italic/underline styles to matching substrings
const parseTextWithPlaceholders = (text, style = {}) => {
    if (!text) return [new TextRun("")];

    const runs = [];
    const parts = String(text).split(/({{[^}]+}})/g);

    parts.forEach(part => {
        if (!part) return;

        const isPlaceholder = /^{{(.+)}}$/.test(part);

        if (isPlaceholder) {
            const innerText = part.replace(/^{{|}}$/g, '');
            // Skip known dynamic tokens that are handled separately
            if (['page_number', 'file_name'].includes(innerText)) {
                runs.push(new TextRun({ text: `[${innerText}]`, font: style.font || "Calibri", size: style.fontSize || 24 }));
                return;
            }
            runs.push(new TextRun({
                text: `[${innerText}]`,
                highlight: "yellow",
                bold: true,
                font: style.font || "Calibri",
                size: style.fontSize || 24,
            }));
        } else {
            const boldPhrases = style.bold || [];
            const italicPhrases = style.italic || [];
            const underlinePhrases = style.underline || [];

            if (boldPhrases.length === 0 && italicPhrases.length === 0 && underlinePhrases.length === 0) {
                runs.push(new TextRun({ text: part, font: style.font || "Calibri", size: style.fontSize || 24 }));
            } else {
                let remaining = part;
                while (remaining.length > 0) {
                    let earliestIdx = remaining.length;
                    let earliestPhrase = null;
                    let phraseStyles = {};

                    const allPhrases = [
                        ...boldPhrases.map(p => ({ text: p, bold: true })),
                        ...italicPhrases.map(p => ({ text: p, italics: true })),
                        ...underlinePhrases.map(p => ({ text: p, underline: { type: UnderlineType.SINGLE } }))
                    ];

                    for (const phrase of allPhrases) {
                        const idx = remaining.toLowerCase().indexOf(phrase.text.toLowerCase());
                        if (idx !== -1 && idx < earliestIdx) {
                            earliestIdx = idx;
                            earliestPhrase = phrase.text;
                            phraseStyles = { ...phraseStyles, ...phrase };
                            delete phraseStyles.text;
                        }
                    }

                    if (earliestPhrase === null) {
                        runs.push(new TextRun({ text: remaining, font: style.font || "Calibri", size: style.fontSize || 24 }));
                        break;
                    }

                    if (earliestIdx > 0) {
                        runs.push(new TextRun({ text: remaining.substring(0, earliestIdx), font: style.font || "Calibri", size: style.fontSize || 24 }));
                    }

                    const matchedText = remaining.substring(earliestIdx, earliestIdx + earliestPhrase.length);
                    runs.push(new TextRun({ text: matchedText, ...phraseStyles, font: style.font || "Calibri", size: style.fontSize || 24 }));
                    remaining = remaining.substring(earliestIdx + earliestPhrase.length);
                }
            }
        }
    });

    return runs.length > 0 ? runs : [new TextRun({ text: String(text), font: "Calibri", size: 24 })];
};

const axios = require("axios");

/**
 * Node.js image fetcher - gets Image Buffer for ImageRun
 */
const fetchImageAsBuffer = async (url) => {
    try {
        if (!url) return null;
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000
        });
        return Buffer.from(response.data);
    } catch (error) {
        console.error(`[fetchImageAsBuffer] Failed for ${url}:`, error.message);
        return null;
    }
};

const buildBorders = (color = "CCCCCC") => ({
    top: { style: BorderStyle.SINGLE, size: 1, color },
    bottom: { style: BorderStyle.SINGLE, size: 1, color },
    left: { style: BorderStyle.SINGLE, size: 1, color },
    right: { style: BorderStyle.SINGLE, size: 1, color },
});

const calcFormula = (values, operation) => {
    const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    if (nums.length === 0) return '-';
    switch (operation?.toUpperCase()) {
        case 'SUM': return nums.reduce((a, b) => a + b, 0).toLocaleString();
        case 'AVERAGE': return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
        case 'MIN': return Math.min(...nums).toLocaleString();
        case 'MAX': return Math.max(...nums).toLocaleString();
        case 'COUNT': return nums.length.toString();
        default: return nums.reduce((a, b) => a + b, 0).toLocaleString();
    }
};

const renderFormulaTable = (block) => {
    const borders = buildBorders("999999");
    const hasFormulas = block.formulas && Array.isArray(block.formulas) && block.formulas.length > 0;
    const allCols = hasFormulas ? [...block.headers, ...block.formulas.map(f => f.column)] : block.headers;
    const totalCols = allCols.length;
    const cellWidth = Math.floor(100 / totalCols);

    const shading = block.conditionalShading || {};
    const numericCols = {};
    block.rows.forEach(row => {
        const cells = Array.isArray(row) ? row : Object.values(row);
        cells.forEach((cell, ci) => {
            const n = parseFloat(cell);
            if (!isNaN(n)) {
                if (!numericCols[ci]) numericCols[ci] = [];
                numericCols[ci].push(n);
            }
        });
    });
    const colMax = {};
    const colMin = {};
    Object.entries(numericCols).forEach(([ci, vals]) => {
        colMax[ci] = Math.max(...vals);
        colMin[ci] = Math.min(...vals);
    });

    const headerRow = new TableRow({
        tableHeader: true,
        children: allCols.map(h => new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text: String(h), bold: true, font: "Calibri", size: 20 })],
                spacing: { after: 40 }
            })],
            borders,
            width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "2F4F8F", type: ShadingType.CLEAR }
        }))
    });

    const dataRows = block.rows.map(row => {
        const cells = Array.isArray(row) ? row : Object.values(row);
        const formulaCells = hasFormulas ? block.formulas.map(f => calcFormula(cells.slice(1), f.operation)) : [];
        const allCellValues = [...cells, ...formulaCells];

        return new TableRow({
            children: allCellValues.map((cell, ci) => {
                const num = parseFloat(cell);
                const isMax = !isNaN(num) && colMax[ci] !== undefined && num === colMax[ci];
                const isMin = !isNaN(num) && colMin[ci] !== undefined && num === colMin[ci] && colMax[ci] !== colMin[ci];
                let fill = "FFFFFF";
                let textColor = "000000";
                if (isMax && shading.highlightMax) { fill = shading.highlightMax.replace('#', ''); textColor = "145A32"; }
                else if (isMin && shading.highlightMin) { fill = shading.highlightMin.replace('#', ''); textColor = "922B21"; }

                return new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: String(cell ?? ''), font: "Calibri", size: 20, color: textColor, bold: isMax || isMin })],
                        spacing: { after: 40 }
                    })],
                    borders,
                    width: { size: cellWidth, type: WidthType.PERCENTAGE },
                    shading: { fill }
                });
            })
        });
    });

    let totalsRow = null;
    if (hasFormulas) {
        const allNumericCols = block.rows.map(r => Array.isArray(r) ? r : Object.values(r));
        const formulaResults = block.formulas.map(f => ({
            label: f.column,
            value: calcFormula(allNumericCols.map(r => r.slice(1)).flat(), f.operation)
        }));
        const labelCell = new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "TOTAL / AVG", bold: true, font: "Calibri", size: 20, color: "FFFFFF" })] })],
            borders, shading: { fill: "2F4F8F" }
        });
        const valueCells = block.headers.slice(1).map(() => new TableCell({ children: [new Paragraph({ text: '' })], borders, shading: { fill: "E8F4FD" } }));
        const formulaValueCells = formulaResults.map(fr => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: fr.value, bold: true, font: "Calibri", size: 20, color: "1A5276" })] })],
            borders, shading: { fill: "D6EAF8" }
        }));
        totalsRow = new TableRow({ children: [labelCell, ...valueCells, ...formulaValueCells] });
    }

    const rows = [headerRow, ...dataRows];
    if (totalsRow) rows.push(totalsRow);
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
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

    // If rawStructure is a string, parse it, otherwise use it as is. 
    // If it's missing, use docData itself as the structure.
    let rescued;
    if (rawStructure) {
        rescued = typeof rawStructure === 'string' ? JSON.parse(rawStructure) : JSON.parse(JSON.stringify(rawStructure));
    } else {
        rescued = JSON.parse(JSON.stringify(docData));
    }

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

/**
 * Normalizes document structure by detecting Markdown-style images
 * in text blocks and converting them into dedicated image blocks.
 */
const normalizeContent = (data) => {
    if (!data || !data.sections || !Array.isArray(data.sections)) return;

    data.sections.forEach(sec => {
        let newBlocks = [];
        const processText = (text, originalBlock = {}) => {
            const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
            let lastIndex = 0;
            let match;
            let found = false;

            while ((match = regex.exec(text)) !== null) {
                found = true;
                const before = text.substring(lastIndex, match.index);
                if (before.trim()) {
                    newBlocks.push({ ...originalBlock, type: originalBlock.type || 'paragraph', text: before.trim() });
                }
                newBlocks.push({ type: 'image', url: match[2], caption: match[1] });
                lastIndex = regex.lastIndex;
            }

            if (found) {
                const after = text.substring(lastIndex);
                if (after.trim()) {
                    newBlocks.push({ ...originalBlock, type: originalBlock.type || 'paragraph', text: after.trim() });
                }
                return true;
            }
            return false;
        };

        if (sec.blocks && Array.isArray(sec.blocks)) {
            sec.blocks.forEach(block => {
                if ((block.type === 'paragraph' || block.type === 'styled_paragraph') && block.text) {
                    if (!processText(block.text, block)) {
                        newBlocks.push(block);
                    }
                } else {
                    newBlocks.push(block);
                }
            });
            sec.blocks = newBlocks;
        } else if (sec.content) {
            if (processText(sec.content)) {
                sec.blocks = newBlocks;
                delete sec.content;
            }
        }
    });
};

// ==========================================
// CORE BUFFER GENERATORS (in-memory, no fs)
// ==========================================

const generateWordBuffer = async (data) => {
    const { title, titleStyle, sections, header, footer, watermark } = data;
    const docChildren = [];

    const numberingConfig = {
        config: [{
            reference: "nurotra-numbering",
            levels: [{
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.START,
                style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } }
            }]
        }]
    };

    const tStyle = titleStyle || {};
    docChildren.push(new Paragraph({
        children: [new TextRun({
            text: String(title || "New Document"),
            bold: tStyle.bold !== false,
            font: tStyle.font || "Calibri",
            size: tStyle.fontSize || 32,
        })],
        heading: HeadingLevel.TITLE,
        alignment: getAlignment(tStyle.align || 'center'),
        spacing: { after: 300 }
    }));

    if (sections && Array.isArray(sections)) {
        for (const sec of sections) {
            if (sec.heading) {
                docChildren.push(new Paragraph({
                    text: String(sec.heading),
                    heading: getHeadingLevel(sec.level || 1),
                    spacing: { before: 240, after: 120 }
                }));
            }
            if (sec.blocks && Array.isArray(sec.blocks)) {
                for (const block of sec.blocks) {
                    try {
                        switch (block.type) {
                            case 'styled_paragraph': {
                                const s = block.style || {};
                                docChildren.push(new Paragraph({
                                    children: parseTextWithPlaceholders(block.text, s),
                                    style: block.style_name || "Normal",
                                    alignment: getAlignment(s.align),
                                    spacing: { after: 120 }
                                }));
                                break;
                            }
                            case 'author_section': {
                                docChildren.push(new Paragraph({
                                    children: [
                                        new TextRun({ text: block.author || "Contributor", bold: true, color: "2F4F8F", size: 24 }),
                                        ...(block.role ? [new TextRun({ text: ` (${block.role})`, italics: true, size: 20 })] : [])
                                    ],
                                    spacing: { before: 200, after: 100 }
                                }));
                                if (block.blocks) {
                                    for (const sub of block.blocks) {
                                        if (sub.type === 'paragraph') {
                                            docChildren.push(new Paragraph({ children: parseTextWithPlaceholders(sub.text), spacing: { after: 100 } }));
                                        }
                                    }
                                }
                                break;
                            }
                            case 'toc': {
                                docChildren.push(new Paragraph({ text: block.title || "Table of Contents", heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));
                                docChildren.push(new Paragraph({ children: [new TextRun({ text: "[Table of Contents will be generated automatically in MS Word]", italics: true, color: "888888" })] }));
                                break;
                            }
                            case 'paragraph': {
                                docChildren.push(new Paragraph({
                                    children: parseTextWithPlaceholders(block.text, block.style || {}),
                                    spacing: { after: 120 }
                                }));
                                break;
                            }
                            case 'bullet': {
                                (block.items || []).forEach(item => {
                                    docChildren.push(new Paragraph({ children: parseTextWithPlaceholders(item), bullet: { level: 0 }, spacing: { after: 60 } }));
                                });
                                break;
                            }
                            case 'numbered': {
                                (block.items || []).forEach(item => {
                                    docChildren.push(new Paragraph({ children: parseTextWithPlaceholders(item), numbering: { reference: "nurotra-numbering", level: 0 }, spacing: { after: 60 } }));
                                });
                                break;
                            }
                            case 'subheading': {
                                docChildren.push(new Paragraph({ text: block.text || "", heading: getHeadingLevel(block.level || 2), spacing: { before: 200, after: 100 } }));
                                break;
                            }
                            case 'table': {
                                if (block.headers && block.rows) {
                                    const borders = buildBorders("999999");
                                    const headerRow = new TableRow({
                                        children: block.headers.map(h => new TableCell({
                                            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22 })] })],
                                            borders, shading: { fill: "E8E8E8" }
                                        }))
                                    });
                                    const dataRows = block.rows.map(row => new TableRow({
                                        children: (Array.isArray(row) ? row : Object.values(row)).map(cell => new TableCell({
                                            children: [new Paragraph({ children: parseTextWithPlaceholders(String(cell || '')) })],
                                            borders
                                        }))
                                    }));
                                    docChildren.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
                                }
                                break;
                            }
                            case 'formula_table': {
                                if (block.headers && block.rows) docChildren.push(renderFormulaTable(block));
                                break;
                            }
                            case 'cover_page': {
                                docChildren.push(new Paragraph({ text: "", spacing: { after: 800 } }));
                                if (block.logo_url) {
                                    const img = await fetchImageAsBuffer(block.logo_url);
                                    if (img) docChildren.push(new Paragraph({ children: [new ImageRun({ data: img, transformation: { width: 150, height: 80 } })], alignment: AlignmentType.CENTER }));
                                }
                                docChildren.push(new Paragraph({ children: [new TextRun({ text: block.title || title || "Report", bold: true, size: 56 })], alignment: AlignmentType.CENTER }));
                                if (block.subtitle) docChildren.push(new Paragraph({ children: [new TextRun({ text: block.subtitle, size: 32, italics: true })], alignment: AlignmentType.CENTER }));
                                docChildren.push(new Paragraph({ children: [new PageBreak()] }));
                                break;
                            }
                            case 'page_break': {
                                docChildren.push(new Paragraph({ children: [new PageBreak()] }));
                                break;
                            }
                            case 'image': {
                                const imgUrl = block.url || data.image_url;
                                const isExampleUrl = imgUrl && (imgUrl.includes('example.com') || imgUrl.includes('placeholder') || imgUrl.includes('localhost') || imgUrl.includes('nurotra.com'));

                                if (imgUrl && !isExampleUrl) {
                                    const img = await fetchImageAsBuffer(imgUrl);
                                    if (img) {
                                        docChildren.push(new Paragraph({ children: [new ImageRun({ data: img, transformation: { width: block.width || 400, height: block.height || 250 } })], alignment: AlignmentType.CENTER }));
                                        if (block.caption) docChildren.push(new Paragraph({ children: [new TextRun({ text: block.caption, italics: true, size: 18 })], alignment: AlignmentType.CENTER }));
                                    } else {
                                        // Real fetch failed for a non-example URL
                                        docChildren.push(new Paragraph({ children: [new TextRun({ text: `🖼️ [Image Download Failed: ${imgUrl}]`, color: "FF0000", italics: true, size: 20 })], alignment: AlignmentType.CENTER }));
                                    }
                                } else {
                                    // No URL OR it's just an example/placeholder URL from the AI
                                    docChildren.push(new Paragraph({ children: [new TextRun({ text: `🖼️ [Image Placeholder: ${block.caption || 'Insert image here'}]`, color: "888888", italics: true, size: 20 })], alignment: AlignmentType.CENTER }));
                                }
                                break;
                            }
                        }
                    } catch (e) { console.warn("Skip block", e.message); }
                }
            } else if (sec.content) {
                String(sec.content).split('\n').filter(p => p.trim()).forEach(p => {
                    docChildren.push(new Paragraph({ children: parseTextWithPlaceholders(p), spacing: { after: 120 } }));
                });
            }
        }
    }

    const headerContent = new Header({
        children: [new Paragraph({
            children: [
                ...(watermark ? [new TextRun({ text: `⚠ ${watermark}  `, color: "CC0000", bold: true, size: 18 })] : []),
                new TextRun({ text: String(header || ""), size: 18 })
            ],
            alignment: AlignmentType.RIGHT
        })]
    });

    const footerContent = new Footer({
        children: [new Paragraph({
            children: [
                new TextRun({ text: String(footer || "").replace('{{file_name}}', data.fileName || ''), size: 18 }),
                new TextRun({ text: " Page ", size: 18 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18 })
            ],
            alignment: AlignmentType.CENTER
        })]
    });

    const doc = new Document({
        numbering: numberingConfig,
        sections: [{
            headers: { default: headerContent },
            footers: { default: footerContent },
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

        if (s.headers && Array.isArray(s.headers)) {
            const headerRow = sheet.addRow(s.headers);
            headerRow.font = { bold: true };
        }

        if (s.rows && Array.isArray(s.rows)) {
            s.rows.forEach((rowObj) => {
                const cells = rowObj.cells || (Array.isArray(rowObj) ? rowObj : Object.values(rowObj));
                const row = sheet.addRow([]);
                cells.forEach((cell, colIdx) => {
                    const excelCell = row.getCell(colIdx + 1);
                    const val = typeof cell === 'object' ? (cell.value ?? '') : cell;
                    const formula = typeof cell === 'object' ? cell.formula : null;

                    if (!isNaN(val) && val !== '' && typeof val !== 'boolean') {
                        excelCell.value = parseFloat(val);
                    } else {
                        excelCell.value = val;
                    }

                    if (formula) {
                        let cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula;
                        excelCell.value = { formula: cleanFormula, result: excelCell.value };
                    }
                });
            });
        }
    });
    return await workbook.xlsx.writeBuffer();
};

const getPPTTheme = (themeName) => {
    const themes = {
        'Modern': { color: '2D3436', accent: '0984E3', font: 'Helvetica', bg: 'FFFFFF' },
        'Corporate': { color: '2C3E50', accent: '2980B9', font: 'Arial', bg: 'F4F7F6' },
        'Dark': { color: 'DFE6E9', accent: '00CEC9', font: 'Verdana', bg: '2D3436' },
        'Creative': { color: '2D3436', accent: '6C5CE7', font: 'Georgia', bg: 'FAFAFA' }
    };
    return themes[themeName] || themes['Modern'];
};

const generatePPTBuffer = async (data) => {
    const pres = new pptxgen();
    const theme = getPPTTheme(data.theme);

    if (data.slides) {
        data.slides.forEach(s => {
            const slide = pres.addSlide();
            slide.background = { fill: theme.bg };

            // Title Bar Accent
            slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.1, fill: theme.accent });

            // Title
            slide.addText(String(s.title || "Slide"), {
                x: 0.5, y: 0.3, w: '90%', h: 0.6,
                fontSize: 32, bold: true, color: 'FFFFFF',
                fontFace: theme.font, align: 'left',
                valign: 'middle'
            });

            // Content Area (y: 1.6 to avoid overlap)
            if (s.bullets && s.bullets.length > 0) {
                slide.addText(
                    s.bullets.map(b => ({ text: String(b), options: { bullet: true, indent: 20, margin: 10 } })),
                    {
                        x: 0.5, y: 1.6, w: '90%', h: 5.0,
                        fontSize: 18, color: theme.color,
                        fontFace: theme.font,
                        lineSpacing: 28,
                        valign: 'top'
                    }
                );
            }

            // Branding
            slide.addText("Nurotra Intelligence", { x: 8.0, y: 7.2, fontSize: 10, color: theme.accent, italic: true });
        });
    }
    return await pres.write('nodebuffer');
};

// ==========================================
// MAIN EXPORT
// ==========================================

const PDFDocument = require("pdfkit-table");

// ... existing helpers ...

const generatePDFBuffer = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const { title, sections, watermark, header, footer } = data;

            // Helper for page numbers and footers
            doc.on('pageAdded', () => {
                if (watermark) {
                    doc.save();
                    doc.opacity(0.1).fontSize(50).fillColor('red');
                    doc.rotate(-45, { origin: [300, 400] });
                    doc.text(watermark, 100, 400, { align: 'center', width: 400 });
                    doc.restore();
                }
            });

            // Watermark for first page
            if (watermark) {
                doc.save();
                doc.opacity(0.1).fontSize(50).fillColor('red');
                doc.rotate(-45, { origin: [300, 400] });
                doc.text(watermark, 100, 400, { align: 'center', width: 400 });
                doc.restore();
            }

            // Title
            if (title) {
                doc.fontSize(24).font('Helvetica-Bold').fillColor('#2d3436').text(title, { align: 'center' });
                doc.moveDown(2);
            }

            if (sections && Array.isArray(sections)) {
                for (const sec of sections) {
                    if (sec.heading) {
                        const fontSize = sec.level === 1 ? 18 : 14;
                        doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#2d3436').text(sec.heading);
                        doc.moveDown(0.5);
                    }

                    if (sec.blocks && Array.isArray(sec.blocks)) {
                        for (const block of sec.blocks) {
                            switch (block.type) {
                                case 'cover_page':
                                    doc.addPage();
                                    doc.moveDown(4);
                                    if (block.logo_url) {
                                        const logo = await fetchImageAsBuffer(block.logo_url);
                                        if (logo) doc.image(logo, { fit: [150, 80], align: 'center' });
                                    }
                                    doc.fontSize(32).font('Helvetica-Bold').text(block.title || title || 'Report', { align: 'center' });
                                    if (block.subtitle) doc.fontSize(16).font('Helvetica-Oblique').text(block.subtitle, { align: 'center' });
                                    doc.addPage();
                                    break;
                                case 'author_section':
                                    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2f4f8f').text(block.author || 'Author');
                                    if (block.role) doc.fontSize(10).font('Helvetica-Oblique').fillColor('#636e72').text(block.role);
                                    doc.moveDown(0.5);
                                    if (block.blocks) {
                                        for (const sub of block.blocks) {
                                            if (sub.type === 'paragraph') doc.fontSize(11).font('Helvetica').fillColor('#000').text(sub.text);
                                        }
                                    }
                                    break;
                                case 'toc':
                                    doc.fontSize(18).font('Helvetica-Bold').text(block.title || 'Table of Contents');
                                    doc.moveDown(0.5);
                                    doc.fontSize(12).font('Helvetica').text("[Generated structure will follow...]");
                                    doc.moveDown();
                                    break;
                                case 'paragraph':
                                case 'styled_paragraph':
                                    const fontSize = block.style?.fontSize ? Math.floor(block.style.fontSize / 2) : 12;
                                    doc.fontSize(fontSize).font('Helvetica').fillColor('#333').text(block.text || '', { align: 'justify' });
                                    break;
                                case 'bullet':
                                    (block.items || []).forEach(item => {
                                        doc.fontSize(12).font('Helvetica').fillColor('#333').text(`• ${item}`, { indent: 20 });
                                    });
                                    break;
                                case 'numbered':
                                    (block.items || []).forEach((item, idx) => {
                                        doc.fontSize(12).font('Helvetica').fillColor('#333').text(`${idx + 1}. ${item}`, { indent: 20 });
                                    });
                                    break;
                                case 'subheading':
                                    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2d3436').text(block.text || '');
                                    break;
                                case 'table':
                                case 'formula_table':
                                    if (block.headers && block.rows) {
                                        const table = {
                                            headers: block.headers,
                                            rows: block.rows.map(row => (Array.isArray(row) ? row : Object.values(row)).map(c => String(c ?? '')))
                                        };
                                        await doc.table(table, {
                                            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                                            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                                                doc.font("Helvetica").fontSize(10);
                                                indexColumn === 0 && doc.addBackground(rectRow, 'white', 0.15);
                                            },
                                        });
                                    }
                                    break;
                                case 'image':
                                    const imgUrl = block.url || data.image_url;
                                    const isExampleUrl = imgUrl && (imgUrl.includes('example.com') || imgUrl.includes('placeholder') || imgUrl.includes('localhost') || imgUrl.includes('nurotra.com'));

                                    if (imgUrl && !isExampleUrl) {
                                        const imgBuffer = await fetchImageAsBuffer(imgUrl);
                                        if (imgBuffer) {
                                            doc.image(imgBuffer, { fit: [500, 300], align: 'center' });
                                            if (block.caption) {
                                                doc.fontSize(10).font('Helvetica-Oblique').text(block.caption, { align: 'center' });
                                            }
                                        } else {
                                            doc.fontSize(10).font('Helvetica-Oblique').fillColor('red').text(`🖼️ [Image Download Failed: ${imgUrl}]`, { align: 'center' });
                                        }
                                    } else {
                                        doc.fontSize(10).font('Helvetica-Oblique').fillColor('grey').text(`🖼️ [Image Placeholder: ${block.caption || 'Insert image here'}]`, { align: 'center' });
                                    }
                                    break;
                                case 'page_break':
                                    doc.addPage();
                                    break;
                            }
                            doc.moveDown();
                        }
                    } else if (sec.content) {
                        doc.fontSize(12).font('Helvetica').fillColor('#333').text(String(sec.content), { align: 'justify' });
                        doc.moveDown();
                    }
                }
            }

            // Footer / Page numbers
            let pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).fillColor('grey').text(
                    `Page ${i + 1} of ${pages.count}`,
                    50,
                    doc.page.height - 50,
                    { align: 'center' }
                );
                if (footer) {
                    doc.text(footer.replace('{{file_name}}', data.fileName || ''), 50, doc.page.height - 65, { align: 'center' });
                }
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

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
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.pdf': 'application/pdf'
    };

    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const baseName = String(docData.name || "Document").replace(/[<>:"/\\|?*]/g, '_').trim();
    const fileName = `${baseName}${ext}`;

    const structure = rescueToFormat(docData, ext);
    normalizeContent(structure);

    let buffer;
    if (ext === '.xlsx') buffer = await generateExcelBuffer(structure);
    else if (ext === '.pptx') buffer = await generatePPTBuffer(structure);
    else if (ext === '.pdf') buffer = await generatePDFBuffer(structure);
    else buffer = await generateWordBuffer(structure);

    return { buffer, ext, mimeType, fileName };
};

module.exports = { generateBuffer };
