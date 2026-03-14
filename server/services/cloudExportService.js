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
// dashboardExportService is now required inside generateBuffer to avoid circular dependency
// const dashboardExportService = require('./dashboardExportService');

// ==========================================
// HELPERS
// ==========================================

const getLuminance = (hex) => {
    const rgb = hex.replace('#', '');
    const r = parseInt(rgb.substring(0, 2), 16);
    const g = parseInt(rgb.substring(2, 4), 16);
    const b = parseInt(rgb.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const getContrastColor = (hex) => getLuminance(hex) > 0.6 ? '333333' : 'FFFFFF';

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
        // Create a more structured "Document Model" for non-dashboard exports
        // This ensures Power BI always sees a high-quality tabular structure
        const summaryRows = [];
        if (rescued.title || docData.name) summaryRows.push(["Title", rescued.title || docData.name]);
        if (type) summaryRows.push(["Document Type", type]);

        const contentRows = content ? String(content).split('\n')
            .filter(l => l.trim())
            .map(l => {
                const clean = l.trim().replace(/^[-*#\d.]+\s+/, '');
                return ["Content Node", clean];
            }) : [["Info", "No content available"]];

        rescued.sheets = [{
            name: "Document Data Model",
            headers: ["Context", "DataValue"],
            rows: [...summaryRows, ...contentRows]
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
                            case 'chart':
                            case 'graph': {
                                const titleText = `📊 Chart: ${block.title || data.graph_config?.title || 'Data Visualization'}`;
                                docChildren.push(new Paragraph({
                                    children: [new TextRun({ text: titleText, bold: true, size: 24, color: "2F4F8F" })],
                                    spacing: { before: 240, after: 120 }
                                }));

                                const graphData = block.data || data.graph_config?.data;
                                if (graphData && Array.isArray(graphData)) {
                                    const borders = buildBorders("CCCCCC");
                                    const headerRow = new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: block.type || 'Category', bold: true, size: 20 })] })], shading: { fill: "E0E6ED" }, borders: borders }),
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Value', bold: true, size: 20 })] })], shading: { fill: "E0E6ED" }, borders: borders })
                                        ]
                                    });
                                    const dataRows = graphData.map(d => new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.name || ''), size: 20 })] })], borders: borders }),
                                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.value || ''), size: 20 })] })], borders: borders })
                                        ]
                                    }));
                                    docChildren.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
                                    docChildren.push(new Paragraph({ text: "", spacing: { after: 240 } }));
                                }
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
    const sheets = data.sheets || [{ name: 'Data', rows: [["No content"]] }];
    const usedSheetNames = new Set();

    for (const s of sheets) {
        // 1. Sanitize & Ensure Unique Sheet Name
        let baseName = String(s.name || 'Sheet').substring(0, 31).replace(/[\[\]\?\*\/\\\:]/g, '');
        let sheetName = baseName;
        let counter = 1;
        while (usedSheetNames.has(sheetName)) {
            sheetName = (baseName.substring(0, 26) + ` (${counter++})`).replace(/[\[\]\?\*\/\\\:]/g, '');
        }
        usedSheetNames.add(sheetName);

        const sheet = workbook.addWorksheet(sheetName);

        // 2. Prepare Headers and Rows
        const headers = (s.headers && Array.isArray(s.headers) && s.headers.length > 0) ? s.headers : ['Data'];
        const rows = (s.rows && Array.isArray(s.rows) && s.rows.length > 0)
            ? s.rows.map(r => Array.isArray(r) ? r : Object.values(r))
            : [['No data available']];

        // Ensure all rows match header length
        const sanitizedRows = rows.map(r => {
            const arr = Array.isArray(r) ? r : [String(r)];
            while (arr.length < headers.length) arr.push('');
            return arr.slice(0, headers.length);
        });

        // 3. Create a formal Excel Table (ListObject) - Power BI LOVES this
        // Table names must be alphanumeric and unique in the workbook
        const tableName = `Table_${sheetName.replace(/[^a-zA-Z0-9]/g, '_')}`;

        try {
            sheet.addTable({
                name: tableName,
                ref: 'A1',
                headerRow: true,
                totalsRow: false,
                style: {
                    theme: 'TableStyleMedium2',
                    showRowStripes: true,
                },
                columns: headers.map(h => ({ name: String(h || 'Column') })),
                rows: sanitizedRows,
            });

            // Auto-fit column widths (heuristic)
            sheet.columns.forEach(column => {
                let maxLen = 10;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const len = cell.value ? String(cell.value).length : 0;
                    if (len > maxLen) maxLen = len;
                });
                column.width = Math.min(maxLen + 2, 50);
            });

        } catch (tableErr) {
            console.warn(`[Excel Export] Table generation failed for ${sheetName}, falling back to raw cells:`, tableErr.message);
            // Fallback to raw cell population if table logic fails
            const headerRow = sheet.addRow(headers);
            headerRow.font = { bold: true };
            sanitizedRows.forEach(r => sheet.addRow(r));
        }
    }

    return await workbook.xlsx.writeBuffer();
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

const generatePPTBuffer = async (data) => {
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
    // Normalize format input
    let normalizedFormat = formatOverride ? formatOverride.toLowerCase().replace('.', '') : null;
    if (normalizedFormat === 'pbi') normalizedFormat = 'xlsx';

    // Choose final format based on override or document default
    const finalFormat = normalizedFormat || (type === 'excel' ? 'xlsx' : type === 'ppt' ? 'pptx' : type === 'dashboard' ? 'xlsx' : 'docx');
    const ext = '.' + finalFormat;

    const mimeMap = {
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.pdf': 'application/pdf'
    };

    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const baseName = String(docData.name || "Document").replace(/[<>:"/\\|?*]/g, '_').trim();
    const fileName = `${baseName}${ext}`;

    // Handle Dashboard specialized export
    if (type === 'dashboard') {
        const dashboardExportService = require('./dashboardExportService');
        const dashboardStructure = typeof docData.rawStructure === 'string' ? JSON.parse(docData.rawStructure) : docData.rawStructure;
        const buffer = await dashboardExportService.exportDashboard(dashboardStructure, finalFormat.replace('.', ''));
        return { buffer, ext, mimeType, fileName };
    }

    const structure = rescueToFormat(docData, ext);
    normalizeContent(structure);

    let buffer;
    if (ext === '.xlsx') buffer = await generateExcelBuffer(structure);
    else if (ext === '.pptx') buffer = await generatePPTBuffer(structure);
    else if (ext === '.pdf') buffer = await generatePDFBuffer(structure);
    else buffer = await generateWordBuffer(structure);

    return { buffer, ext, mimeType, fileName };
};

module.exports = {
    generateBuffer,
    generateWordBuffer,
    generateExcelBuffer,
    generatePPTBuffer,
    generatePDFBuffer
};
