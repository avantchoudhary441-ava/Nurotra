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
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Use a dynamic base path relative to the project root (works on any device)
const WORKSPACE_BASE = path.resolve(process.cwd(), "..", "nurotra workplace");

// ==========================================
// HELPER: Parse text with {{placeholder}} markers
// Returns an array of TextRun objects with placeholders highlighted yellow
// Also applies inline bold/italic/underline styles
// ==========================================
const parseTextWithPlaceholders = (text, style = {}) => {
    if (!text) return [new TextRun("")];

    const runs = [];
    const parts = text.split(/({{[^}]+}})/g);

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
            const boldPhrases = style.bold || [];
            const italicPhrases = style.italic || [];
            const underlinePhrases = style.underline || [];

            if (boldPhrases.length === 0 && italicPhrases.length === 0 && underlinePhrases.length === 0) {
                runs.push(new TextRun({
                    text: part,
                    font: style.font || "Calibri",
                    size: style.fontSize || 24,
                }));
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

    return runs.length > 0 ? runs : [new TextRun({ text: text, font: "Calibri", size: 24 })];
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

/**
 * Ensures the target directory exists, creating user and project subfolders if needed.
 */
const ensureDirectory = (userName, projectName) => {
    // 1. Resolve Base Workspace
    if (!fs.existsSync(WORKSPACE_BASE)) {
        fs.mkdirSync(WORKSPACE_BASE, { recursive: true });
    }

    // 2. Resolve User Folder (e.g., Anuj)
    const safeUserName = userName ? userName.replace(/[^a-z0-9]/gi, '_') : "Guest";
    const userPath = path.join(WORKSPACE_BASE, safeUserName);
    if (!fs.existsSync(userPath)) {
        fs.mkdirSync(userPath, { recursive: true });
    }

    // 3. Resolve Project Folder
    const safeProjectName = projectName ? projectName.replace(/[^a-z0-9]/gi, '_') : "Standalone";
    const projectPath = path.join(userPath, safeProjectName);

    if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
    }

    return projectPath;
};

/**
 * Parses markdown-style tables (| Col |) into a grid of cells.
 */
const parseMarkdownTable = (text) => {
    const lines = text.split('\n');
    const rows = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        // Match lines that start and end with | or have at least 2 | in them
        if (trimmed.startsWith('|') || (trimmed.match(/\|/g) || []).length >= 2) {
            // Check if it's a separator line (e.g., |---|---|)
            if (trimmed.match(/^[|:\-\s]+$/)) return;

            const cells = trimmed
                .split('|')
                .filter((_, i, arr) => (i > 0 && i < arr.length - 1) || (i === 0 && arr.length === 1))
                .map(c => c.trim());

            if (cells.length > 0) {
                rows.push({ cells: cells.map(v => ({ value: v, formula: "" })) });
            }
        }
    });
    return rows;
};

/**
 * Format Rescue: Dynamically remaps document data to the target schema 
 * if the original structure doesn't match the requested export format.
 */
const rescueToFormat = (docData, targetExt) => {
    const { rawStructure, type, content } = docData;
    let rescued = { ...rawStructure };

    // 1. Text -> Excel Rescue (Enhanced with Markdown Table Parsing)
    if (targetExt === '.xlsx' && (!rawStructure.sheets || rawStructure.sheets.length === 0)) {
        const sheets = [];

        // Try to find sections that look like sheets
        if (rawStructure.sections) {
            rawStructure.sections.forEach(sec => {
                const sheetRows = [];
                if (sec.heading) sheetRows.push({ cells: [{ value: sec.heading, bold: true }] });

                // Parse markdown tables if they exist in the section content
                if (sec.content && sec.content.includes('|')) {
                    const parsedRows = parseMarkdownTable(sec.content);
                    if (parsedRows.length > 0) {
                        sheetRows.push(...parsedRows);
                    } else {
                        sec.content.split('\n').filter(p => p.trim()).forEach(p => sheetRows.push({ cells: [p] }));
                    }
                } else if (sec.content) {
                    sec.content.split('\n').filter(p => p.trim()).forEach(p => sheetRows.push({ cells: [p] }));
                }

                sheets.push({ name: (sec.heading || "Sheet").substring(0, 30), rows: sheetRows });
            });
        }

        // If still no sheets, try parsing the whole content block
        if (sheets.length === 0 && content) {
            const globalRows = parseMarkdownTable(content);
            if (globalRows.length > 0) {
                sheets.push({ name: 'Parsed Data', rows: globalRows });
            }
        }

        rescued.sheets = sheets.length > 0 ? sheets : [{ name: 'Document Content', rows: [{ cells: [rawStructure.title || "Untitled"] }] }];
    }

    // 2. Text -> PPT Rescue
    if (targetExt === '.pptx' && !rawStructure.slides) {
        const slides = [];
        if (rawStructure.sections) {
            rawStructure.sections.forEach(sec => {
                slides.push({
                    title: sec.heading || "Section",
                    bullets: sec.content ? sec.content.split('\n').filter(p => p.trim().length > 3).slice(0, 5) : []
                });
            });
        }
        rescued.slides = slides.length > 0 ? slides : [{ title: rawStructure.title || "Document", bullets: ["Exported from Nurotra"] }];
    }

    // 3. Data -> Word Rescue (e.g., if someone tries to export an Excel sheet as Word)
    if (targetExt === '.docx' && !rawStructure.sections) {
        const sections = [];
        if (rawStructure.sheets) {
            rawStructure.sheets.forEach(sheet => {
                const blocks = [];
                if (sheet.headers && sheet.rows) {
                    // Convert to a proper table block
                    const tableRows = sheet.rows.map(row => {
                        const cells = row.cells || row;
                        return cells.map(c => typeof c === 'object' ? String(c.value || '') : String(c || ''));
                    });
                    blocks.push({
                        type: 'table',
                        headers: sheet.headers,
                        rows: tableRows
                    });
                } else if (sheet.rows) {
                    // No headers — use first row as headers if available
                    const allRows = sheet.rows.map(row => {
                        const cells = row.cells || row;
                        return cells.map(c => typeof c === 'object' ? String(c.value || '') : String(c || ''));
                    });
                    if (allRows.length > 1) {
                        blocks.push({
                            type: 'table',
                            headers: allRows[0],
                            rows: allRows.slice(1)
                        });
                    } else {
                        allRows.forEach(row => {
                            blocks.push({ type: 'bullet', items: row });
                        });
                    }
                }
                sections.push({ heading: sheet.name, level: 1, blocks });
            });
        }
        rescued.title = rawStructure.title || "Data Report";
        rescued.sections = sections;
    }

    return rescued;
};

/**
 * Automates the saving of a document to the local workspace.
 */
const automateLocalSave = async (docData, projectName, userName, formatOverride) => {
    const { name, type } = docData;
    const saveDir = ensureDirectory(userName, projectName);

    // Determine target extension
    const finalFormat = formatOverride || (type === 'excel' ? 'xlsx' : type === 'ppt' ? 'pptx' : 'docx');
    const ext = finalFormat.startsWith('.') ? finalFormat :
        (finalFormat === 'excel' || finalFormat === 'xlsx') ? '.xlsx' :
            (finalFormat === 'ppt' || finalFormat === 'pptx') ? '.pptx' : '.docx';

    // Rescue the data structure to match the target extension
    const rescuedStructure = rescueToFormat(docData, ext);

    const baseName = name.replace(/\.(docx|xlsx|pptx|doc|xls|ppt)$/i, '');
    const fileName = `${baseName}${ext}`;
    const fullPath = path.join(saveDir, fileName);

    try {
        if (ext === '.xlsx') {
            await saveExcel(rescuedStructure, fullPath);
        } else if (ext === '.pptx') {
            await savePPT(rescuedStructure, fullPath);
        } else {
            await saveWord(rescuedStructure, fullPath);
        }
        return { success: true, path: fullPath };
    } catch (error) {
        console.error("Local Save Error:", error);
        throw error;
    }
};

const saveExcel = async (data, fullPath) => {
    const workbook = new ExcelJS.Workbook();
    const sheets = data.sheets || [{ name: 'Sheet 1', rows: data.rows }];

    sheets.forEach(sheetData => {
        const sheet = workbook.addWorksheet(sheetData.name || 'Sheet 1');

        if (sheetData.headers) {
            const headerRow = sheet.addRow(sheetData.headers);
            headerRow.font = { bold: true };
            // Simple gray border for headers
            headerRow.eachCell(cell => {
                cell.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
        }

        if (sheetData.rows) {
            sheetData.rows.forEach(rowObj => {
                const cells = rowObj.cells || rowObj;
                const row = sheet.addRow([]);
                cells.forEach((cell, colIdx) => {
                    const excelCell = row.getCell(colIdx + 1);
                    const val = typeof cell === 'object' ? cell.value : cell;
                    const formula = typeof cell === 'object' ? cell.formula : null;
                    const validation = typeof cell === 'object' ? cell.dataValidation : null;

                    if (!isNaN(val) && val !== '' && typeof val !== 'boolean') {
                        excelCell.value = parseFloat(val);
                    } else {
                        excelCell.value = val;
                    }

                    if (formula) {
                        let cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula;
                        excelCell.value = {
                            formula: cleanFormula,
                            result: excelCell.value
                        };
                    }

                    // Apply individual cell validation (e.g. "must be > 0")
                    if (validation) {
                        excelCell.dataValidation = validation;
                    }

                    excelCell.alignment = { vertical: 'middle', horizontal: 'left' };
                });
            });
        }

        // Apply Sheet-level Conditional Formatting (Color scales, Data Bars, Highlighting)
        if (sheetData.conditionalFormatting && Array.isArray(sheetData.conditionalFormatting)) {
            sheetData.conditionalFormatting.forEach(rule => {
                try {
                    sheet.addConditionalFormatting({
                        ref: rule.ref,
                        rules: rule.rules
                    });
                } catch (cfError) {
                    console.warn("[ExcelSync] CF Rule failed:", cfError.message);
                }
            });
        }

        // Apply Auto-column width (Simple heuristic)
        sheet.columns.forEach(column => {
            let maxLen = 10;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const len = cell.value ? String(cell.value).length : 0;
                if (len > maxLen) maxLen = len;
            });
            column.width = maxLen + 2;
        });
    });

    await workbook.xlsx.writeFile(fullPath);
};

// ==========================================
// HELPER: Fetch image from URL as Buffer (server-side)
// ==========================================
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
// HELPER: Build table borders
// ==========================================
const buildDocxBorders = (color = "CCCCCC") => ({
    top: { style: BorderStyle.SINGLE, size: 1, color },
    bottom: { style: BorderStyle.SINGLE, size: 1, color },
    left: { style: BorderStyle.SINGLE, size: 1, color },
    right: { style: BorderStyle.SINGLE, size: 1, color },
});

// ==========================================
// HELPER: Compute formula on array of values
// ==========================================
const computeFormula = (values, operation) => {
    const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    if (nums.length === 0) return '-';
    switch ((operation || '').toUpperCase()) {
        case 'SUM': return nums.reduce((a, b) => a + b, 0).toLocaleString();
        case 'AVERAGE': return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
        case 'MIN': return Math.min(...nums).toLocaleString();
        case 'MAX': return Math.max(...nums).toLocaleString();
        case 'COUNT': return nums.length.toString();
        default: return nums.reduce((a, b) => a + b, 0).toLocaleString();
    }
};

// ==========================================
// HELPER: Render formula_table as docx Table
// ==========================================
const renderDocxFormulaTable = (block) => {
    const borders = buildDocxBorders("999999");
    const hasFormulas = block.formulas && block.formulas.length > 0;
    const allCols = hasFormulas ? [...block.headers, ...block.formulas.map(f => f.column)] : block.headers;
    const totalCols = allCols.length;
    const cellWidth = Math.floor(100 / totalCols);
    const shading = block.conditionalShading || {};

    // Find min/max per numeric column for conditional shading
    const colMax = {};
    const colMin = {};
    block.rows.forEach(row => {
        row.forEach((cell, ci) => {
            const n = parseFloat(cell);
            if (!isNaN(n)) {
                if (colMax[ci] === undefined || n > colMax[ci]) colMax[ci] = n;
                if (colMin[ci] === undefined || n < colMin[ci]) colMin[ci] = n;
            }
        });
    });

    // Header row
    const headerRow = new TableRow({
        tableHeader: true,
        children: allCols.map(h => new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text: String(h), bold: true, font: "Calibri", size: 20, color: "FFFFFF" })],
                spacing: { after: 40 }
            })],
            borders,
            width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "2F4F8F", type: ShadingType.CLEAR, color: "auto" }
        }))
    });

    // Data rows
    const dataRows = block.rows.map(row => {
        const cells = Array.isArray(row) ? row : Object.values(row);
        const formulaCells = hasFormulas ? block.formulas.map(f => computeFormula(cells.slice(1), f.operation)) : [];
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
                    shading: { fill, type: ShadingType.CLEAR, color: "auto" }
                });
            })
        });
    });

    // Totals row
    let totalsRow = null;
    if (hasFormulas) {
        const allNumericCols = block.rows.map(r => Array.isArray(r) ? r : Object.values(r));
        const formulaResults = block.formulas.map(f => computeFormula(allNumericCols.map(r => r.slice(1)).flat(), f.operation));
        const labelCell = new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "TOTAL / AVG", bold: true, font: "Calibri", size: 20, color: "FFFFFF" })], spacing: { after: 40 } })],
            borders, width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "2F4F8F", type: ShadingType.CLEAR }
        });
        const emptyCells = block.headers.slice(1).map(() => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: '', font: "Calibri", size: 20 })], spacing: { after: 40 } })],
            borders, width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "E8F4FD", type: ShadingType.CLEAR }
        }));
        const fCells = formulaResults.map(fr => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(fr), bold: true, font: "Calibri", size: 20, color: "1A5276" })], spacing: { after: 40 } })],
            borders, width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "D6EAF8", type: ShadingType.CLEAR }
        }));
        totalsRow = new TableRow({ children: [labelCell, ...emptyCells, ...fCells] });
    }

    const rows = [headerRow, ...dataRows];
    if (totalsRow) rows.push(totalsRow);
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
};

const saveWord = async (data, fullPath) => {
    const { title, titleStyle, sections, header, footer, watermark, protection } = data;

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
    const titleParagraph = new Paragraph({
        children: [new TextRun({
            text: title || "New Document",
            bold: tStyle.bold !== false,
            underline: tStyle.underline ? { type: UnderlineType.SINGLE } : undefined,
            font: tStyle.font || "Calibri",
            size: tStyle.fontSize || 32,
        })],
        heading: HeadingLevel.TITLE,
        alignment: getAlignment(tStyle.align || 'center'),
        spacing: { after: 300 }
    });

    const docChildren = [titleParagraph];

    if (sections) {
        for (const sec of sections) {
            if (sec.heading && sec.heading.trim()) {
                docChildren.push(new Paragraph({
                    text: sec.heading,
                    heading: getHeadingLevel(sec.level || 1),
                    spacing: { before: 240, after: 120 }
                }));
            }

            if (sec.blocks && Array.isArray(sec.blocks)) {
                for (const block of sec.blocks) {
                    switch (block.type) {
                        case 'paragraph': {
                            const style = block.style || {};
                            docChildren.push(new Paragraph({
                                children: parseTextWithPlaceholders(block.text, style),
                                alignment: getAlignment(style.align),
                                spacing: { after: 120 }
                            }));
                            break;
                        }
                        case 'bullet': {
                            (block.items || []).forEach(item => {
                                docChildren.push(new Paragraph({
                                    children: parseTextWithPlaceholders(item, {}),
                                    bullet: { level: 0 },
                                    spacing: { after: 60 }
                                }));
                            });
                            break;
                        }
                        case 'numbered': {
                            (block.items || []).forEach(item => {
                                docChildren.push(new Paragraph({
                                    children: parseTextWithPlaceholders(item, {}),
                                    numbering: { reference: "nurotra-numbering", level: 0 },
                                    spacing: { after: 60 }
                                }));
                            });
                            break;
                        }
                        case 'subheading': {
                            docChildren.push(new Paragraph({
                                text: block.text || "",
                                heading: getHeadingLevel(block.level || 2),
                                spacing: { before: 200, after: 100 }
                            }));
                            break;
                        }
                        case 'table': {
                            if (block.headers && block.rows) {
                                const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
                                const borders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };
                                const headerRow = new TableRow({
                                    tableHeader: true,
                                    children: block.headers.map(h => new TableCell({
                                        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: "Calibri", size: 22 })], spacing: { after: 40 } })],
                                        borders,
                                        width: { size: Math.floor(100 / block.headers.length), type: WidthType.PERCENTAGE },
                                        shading: { fill: "E8E8E8", type: ShadingType.CLEAR }
                                    }))
                                });
                                const dataRows = block.rows.map(row => {
                                    const cells = Array.isArray(row) ? row : Object.values(row);
                                    return new TableRow({
                                        children: cells.map(cell => new TableCell({
                                            children: [new Paragraph({ children: parseTextWithPlaceholders(String(cell || ''), {}), spacing: { after: 40 } })],
                                            borders,
                                            width: { size: Math.floor(100 / block.headers.length), type: WidthType.PERCENTAGE }
                                        }))
                                    });
                                });
                                docChildren.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
                                docChildren.push(new Paragraph({ text: "", spacing: { after: 120 } }));
                            }
                            break;
                        }
                        case 'formula_table': {
                            if (block.headers && block.rows) {
                                docChildren.push(renderDocxFormulaTable(block));
                                docChildren.push(new Paragraph({ text: "", spacing: { after: 120 } }));
                            }
                            break;
                        }
                        case 'cover_page': {
                            docChildren.push(new Paragraph({ text: "", spacing: { after: 800 } }));
                            if (block.logo_url) {
                                const imgBuf = await fetchImageBuffer(block.logo_url);
                                if (imgBuf) {
                                    docChildren.push(new Paragraph({
                                        children: [new ImageRun({ data: imgBuf, transformation: { width: block.logo_width || 150, height: block.logo_height || 80 } })],
                                        alignment: AlignmentType.CENTER,
                                        spacing: { after: 300 }
                                    }));
                                }
                            }
                            docChildren.push(new Paragraph({
                                children: [new TextRun({ text: block.title || title || "Report", bold: true, size: 56, font: "Calibri" })],
                                alignment: AlignmentType.CENTER, spacing: { after: 200 }
                            }));
                            if (block.subtitle) {
                                docChildren.push(new Paragraph({
                                    children: [new TextRun({ text: block.subtitle, size: 32, font: "Calibri", italics: true, color: "555555" })],
                                    alignment: AlignmentType.CENTER, spacing: { after: 400 }
                                }));
                            }
                            if (block.company) {
                                docChildren.push(new Paragraph({
                                    children: parseTextWithPlaceholders(block.company, { fontSize: 28 }),
                                    alignment: AlignmentType.CENTER, spacing: { after: 100 }
                                }));
                            }
                            if (block.date) {
                                docChildren.push(new Paragraph({
                                    children: parseTextWithPlaceholders(block.date, { fontSize: 24 }),
                                    alignment: AlignmentType.CENTER, spacing: { after: 600 }
                                }));
                            }
                            docChildren.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));
                            break;
                        }
                        case 'page_break': {
                            docChildren.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));
                            break;
                        }
                        case 'image': {
                            const imgBuf = block.url ? await fetchImageBuffer(block.url) : null;
                            if (imgBuf) {
                                docChildren.push(new Paragraph({
                                    children: [new ImageRun({ data: imgBuf, transformation: { width: block.width || 400, height: block.height || 250 } })],
                                    alignment: AlignmentType.CENTER, spacing: { after: 80 }
                                }));
                            } else {
                                docChildren.push(new Paragraph({
                                    children: [new TextRun({ text: `[Image: ${block.caption || 'Insert image here'}]`, highlight: "yellow", bold: true, font: "Calibri", size: 24 })],
                                    alignment: AlignmentType.CENTER, spacing: { after: 200 }
                                }));
                            }
                            if (block.caption && imgBuf) {
                                docChildren.push(new Paragraph({
                                    children: [new TextRun({ text: block.caption, italics: true, size: 18, color: "888888" })],
                                    alignment: AlignmentType.CENTER, spacing: { after: 200 }
                                }));
                            }
                            break;
                        }
                        case 'watermark': break; // handled at doc level
                        default: {
                            if (block.text) {
                                docChildren.push(new Paragraph({
                                    children: parseTextWithPlaceholders(block.text, block.style || {}),
                                    spacing: { after: 100 }
                                }));
                            }
                        }
                    }
                }
            } else if (sec.content) {
                sec.content.split('\n').filter(p => p.trim()).forEach(p => {
                    docChildren.push(new Paragraph({
                        children: parseTextWithPlaceholders(p, {}),
                        spacing: { after: 100 }
                    }));
                });
            }
        }
    }

    // --- Header ---
    const docWatermark = watermark || data.watermark;
    const headerText = header || "";
    const footerText = footer || "";
    const docFileName = data.fileName || data.name || '';

    const headerContent = new Header({
        children: [new Paragraph({
            children: [
                ...(docWatermark ? [new TextRun({ text: `⚠ ${docWatermark}  `, color: "CC0000", bold: true, size: 18 })] : []),
                new TextRun({ text: headerText, font: "Calibri", size: 18, color: "555555" })
            ],
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } }
        })]
    });

    // --- Footer with dynamic page number ---
    const footerParts = footerText.split('{{page_number}}');
    const footerChildren = [];
    if (footerParts.length > 1) {
        const leftText = footerParts[0].replace('{{file_name}}', docFileName);
        const rightText = footerParts[1].replace('{{file_name}}', docFileName);
        footerChildren.push(
            new TextRun({ text: leftText, font: "Calibri", size: 18, color: "888888" }),
            new PageNumber({ format: NumberFormat.DECIMAL }),
            new TextRun({ text: rightText, font: "Calibri", size: 18, color: "888888" })
        );
    } else {
        footerChildren.push(new TextRun({ text: footerText.replace('{{file_name}}', docFileName), font: "Calibri", size: 18, color: "888888" }));
    }
    const footerContent = new Footer({
        children: [new Paragraph({
            children: footerChildren,
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } }
        })]
    });

    // --- Build Document ---
    const docConfig = {
        numbering: numberingConfig,
        sections: [{
            properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
            headers: { default: headerContent },
            footers: { default: footerContent },
            children: docChildren,
        }],
    };

    if (protection && protection.readOnly) {
        docConfig.settings = { documentProtection: { edit: "readOnly", enforcement: true } };
    }

    const doc = new Document(docConfig);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
};

const savePPT = async (data, fullPath) => {
    const { slides } = data;
    const pres = new pptxgen();

    if (slides) {
        slides.forEach(slideData => {
            const slide = pres.addSlide();
            slide.addText(slideData.title || "Slide", {
                x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636'
            });
            if (slideData.bullets) {
                slide.addText(slideData.bullets.join('\n'), {
                    x: 0.5, y: 1.5, w: '90%', h: '70%', fontSize: 18, color: '666666', bullet: true
                });
            }
        });
    }

    await pres.writeFile({ fileName: fullPath });
};

/**
 * Opens the local workspace folder in File Explorer.
 */
const openWorkspace = (projectName, userName) => {
    console.log(`[LocalSync] Opening workspace for User: ${userName}, Project: ${projectName || "Standalone"}`);
    const projectPath = ensureDirectory(userName, projectName);
    console.log("[LocalSync] Resolved system path:", projectPath);

    // Ensure directory exists before opening
    if (!fs.existsSync(projectPath)) {
        console.log("[LocalSync] Directory does not exist, creating:", projectPath);
        fs.mkdirSync(projectPath, { recursive: true });
    }

    // Windows 'start' command is more robust than 'explorer' for folders with spaces
    const command = `start "" "${projectPath}"`;
    console.log("[LocalSync] Executing system command:", command);

    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) {
                console.error("[LocalSync] Command failed:", error);
                reject(error);
            } else {
                console.log("[LocalSync] Explorer opened successfully.");
                resolve({ success: true, path: projectPath });
            }
        });
    });
};

/**
 * Opens a native Windows folder picker using PowerShell.
 */
const pickFolder = () => {
    const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $browser = New-Object System.Windows.Forms.FolderBrowserDialog
        $browser.Description = "Select a folder for your DocsAgent Workspace"
        $show = $browser.ShowDialog()
        if ($show -eq "OK") {
            return $browser.SelectedPath
        } else {
            return ""
        }
    `;

    return new Promise((resolve, reject) => {
        exec(`powershell -Command "${script.replace(/\n/g, ' ')}"`, (error, stdout) => {
            if (error) {
                console.error("[LocalSync] Folder Picker Error:", error);
                reject(error);
            } else {
                const selectedPath = stdout.trim();
                resolve(selectedPath);
            }
        });
    });
};

/**
 * Recursively scans a directory for office files.
 */
const scanDirectory = (dirPath) => {
    const results = [];
    const list = fs.readdirSync(dirPath, { withFileTypes: true });

    list.forEach(item => {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
            results.push({
                name: item.name,
                path: fullPath,
                type: 'folder',
                children: scanDirectory(fullPath)
            });
        } else {
            const ext = path.extname(item.name).toLowerCase();
            if (['.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'].includes(ext)) {
                const stats = fs.statSync(fullPath);
                results.push({
                    name: item.name,
                    path: fullPath,
                    type: ext.includes('doc') ? 'word' : ext.includes('xl') ? 'excel' : 'ppt',
                    size: stats.size,
                    updatedAt: stats.mtime
                });
            }
        }
    });

    return results;
};

/**
 * Gets the last N modified files across the workspace.
 */
const getRecentFiles = (rootPath, limit = 10) => {
    const allFiles = [];
    const flatten = (items) => {
        items.forEach(item => {
            if (item.type === 'folder') flatten(item.children);
            else allFiles.push(item);
        });
    };

    const tree = scanDirectory(rootPath);
    flatten(tree);

    return allFiles
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
};

module.exports = {
    automateLocalSave,
    openWorkspace,
    pickFolder,
    scanDirectory,
    getRecentFiles
};
