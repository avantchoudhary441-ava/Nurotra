import {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, UnderlineType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    LevelFormat, convertInchesToTwip,
    Header, Footer, PageNumber, NumberFormat,
    PageBreak, ShadingType,
    ImageRun
} from "docx";
import pptxgen from "pptxgenjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ==========================================
// HELPER: Parse text with {{placeholder}} markers
// Returns an array of TextRun objects with placeholders highlighted yellow
// Also applies inline bold/italic/underline styles to matching substrings
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

    return runs.length > 0 ? runs : [new TextRun({ text: text, font: "Calibri", size: 24 })];
};

const getAlignment = (align) => {
    switch (align?.toLowerCase()) {
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

// ==========================================
// HELPER: Fetch image from URL as ArrayBuffer
// ==========================================
const fetchImageAsBuffer = async (url) => {
    try {
        if (!url) return null;
        const response = await fetch(url);
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        return buffer;
    } catch {
        return null;
    }
};

// ==========================================
// HELPER: Build table border config
// ==========================================
const buildBorders = (color = "CCCCCC") => ({
    top: { style: BorderStyle.SINGLE, size: 1, color },
    bottom: { style: BorderStyle.SINGLE, size: 1, color },
    left: { style: BorderStyle.SINGLE, size: 1, color },
    right: { style: BorderStyle.SINGLE, size: 1, color },
});

// ==========================================
// HELPER: Calculate formula totals/averages
// ==========================================
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

// ==========================================
// HELPER: Render a formula_table block into docx Table
// ==========================================
const renderFormulaTable = (block, colWidth) => {
    const borders = buildBorders("999999");
    const numCols = block.headers.length;
    const hasFormulas = block.formulas && Array.isArray(block.formulas) && block.formulas.length > 0;
    const allCols = hasFormulas ? [...block.headers, ...block.formulas.map(f => f.column)] : block.headers;
    const totalCols = allCols.length;
    const cellWidth = Math.floor(100 / totalCols);

    // --- Conditional shading: find max/min per numeric column ---
    const shading = block.conditionalShading || {};
    const numericCols = {}; // col index -> [values]
    block.rows.forEach(row => {
        row.forEach((cell, ci) => {
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

    // --- Header row ---
    const headerRow = new TableRow({
        tableHeader: true,
        children: allCols.map(h => new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text: String(h), bold: true, font: "Calibri", size: 20 })],
                spacing: { after: 40 }
            })],
            borders,
            width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "2F4F8F", type: ShadingType.CLEAR, color: "auto" }
        }))
    });

    // --- Data rows ---
    const dataRows = block.rows.map(row => {
        const cells = Array.isArray(row) ? row : Object.values(row);
        // Compute formula columns
        const dataNums = cells.map(c => parseFloat(c)).filter(n => !isNaN(n));
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
                        children: [new TextRun({
                            text: String(cell !== null && cell !== undefined ? cell : ''),
                            font: "Calibri", size: 20,
                            color: textColor,
                            bold: isMax || isMin
                        })],
                        spacing: { after: 40 }
                    })],
                    borders,
                    width: { size: cellWidth, type: WidthType.PERCENTAGE },
                    shading: { fill, type: ShadingType.CLEAR, color: "auto" }
                });
            })
        });
    });

    // --- Totals row ---
    let totalsRow = null;
    if (hasFormulas) {
        const allNumericCols = block.rows.map(r => Array.isArray(r) ? r : Object.values(r));
        const formulaResults = block.formulas.map(f => ({
            label: f.column,
            value: calcFormula(allNumericCols.map(r => r.slice(1)).flat(), f.operation)
        }));
        const labelCell = new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text: "TOTAL / AVG", bold: true, font: "Calibri", size: 20, color: "FFFFFF" })],
                spacing: { after: 40 }
            })],
            borders,
            width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "2F4F8F", type: ShadingType.CLEAR }
        });
        const valueCells = block.headers.slice(1).map(() => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: '', font: "Calibri", size: 20 })], spacing: { after: 40 } })],
            borders,
            width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "E8F4FD", type: ShadingType.CLEAR }
        }));
        const formulaValueCells = formulaResults.map(fr => new TableCell({
            children: [new Paragraph({
                children: [new TextRun({ text: fr.value, bold: true, font: "Calibri", size: 20, color: "1A5276" })],
                spacing: { after: 40 }
            })],
            borders,
            width: { size: cellWidth, type: WidthType.PERCENTAGE },
            shading: { fill: "D6EAF8", type: ShadingType.CLEAR }
        }));
        totalsRow = new TableRow({ children: [labelCell, ...valueCells, ...formulaValueCells] });
    }

    const rows = [headerRow, ...dataRows];
    if (totalsRow) rows.push(totalsRow);

    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
};

// ==========================================
// WORD DOCUMENT GENERATOR (Rich Content Blocks + Advanced Features)
// ==========================================
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

export const generateWordDoc = async (docData) => {
    try {
        const data = JSON.parse(JSON.stringify(docData));
        normalizeContent(data);
        const { fileName, title, titleStyle, sections, header, footer, watermark, protection } = data;

        // --- Numbering config for numbered lists ---
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

        // --- Title ---
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

        // --- Process Sections ---
        if (sections && Array.isArray(sections)) {
            for (const sec of sections) {
                // Section heading (skip if empty)
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
                            case 'styled_paragraph': {
                                const s = block.style || {};
                                const styleName = block.style_name || "Normal";
                                const runs = parseTextWithPlaceholders(block.text, s);
                                docChildren.push(new Paragraph({
                                    children: runs,
                                    style: styleName,
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
                                // Recursively process internal blocks if any
                                if (block.blocks && Array.isArray(block.blocks)) {
                                    // Note: Simplified for now, just append as direct children
                                    for (const subBlock of block.blocks) {
                                        // Handle basic paragraph for subblocks
                                        if (subBlock.type === 'paragraph') {
                                            docChildren.push(new Paragraph({
                                                children: parseTextWithPlaceholders(subBlock.text, subBlock.style || {}),
                                                spacing: { after: 100 }
                                            }));
                                        }
                                    }
                                }
                                break;
                            }
                            case 'toc': {
                                docChildren.push(new Paragraph({
                                    text: block.title || "Table of Contents",
                                    heading: HeadingLevel.HEADING_1,
                                    spacing: { after: 200 }
                                }));
                                // For now, we'll render a placeholder paragraph as docx library 
                                // TOC generation requires complex field codes or post-processing.
                                docChildren.push(new Paragraph({
                                    children: [new TextRun({ text: "[Table of Contents will be generated automatically in MS Word]", italics: true, color: "888888" })],
                                    spacing: { after: 200 }
                                }));
                                break;
                            }
                            case 'paragraph': {
                                const style = block.style || {};
                                const runs = parseTextWithPlaceholders(block.text, style);
                                docChildren.push(new Paragraph({
                                    children: runs,
                                    alignment: getAlignment(style.align),
                                    spacing: { after: 120 }
                                }));
                                break;
                            }
                            case 'bullet': {
                                if (block.items && Array.isArray(block.items)) {
                                    block.items.forEach(item => {
                                        docChildren.push(new Paragraph({
                                            children: parseTextWithPlaceholders(item, {}),
                                            bullet: { level: 0 },
                                            spacing: { after: 60 }
                                        }));
                                    });
                                }
                                break;
                            }
                            case 'numbered': {
                                if (block.items && Array.isArray(block.items)) {
                                    block.items.forEach(item => {
                                        docChildren.push(new Paragraph({
                                            children: parseTextWithPlaceholders(item, {}),
                                            numbering: { reference: "nurotra-numbering", level: 0 },
                                            spacing: { after: 60 }
                                        }));
                                    });
                                }
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
                                    const borders = buildBorders("999999");
                                    const headerRow = new TableRow({
                                        tableHeader: true,
                                        children: block.headers.map(h => new TableCell({
                                            children: [new Paragraph({
                                                children: [new TextRun({ text: h, bold: true, font: "Calibri", size: 22 })],
                                                spacing: { after: 40 }
                                            })],
                                            borders,
                                            width: { size: Math.floor(100 / block.headers.length), type: WidthType.PERCENTAGE },
                                            shading: { fill: "E8E8E8", type: ShadingType.CLEAR }
                                        }))
                                    });
                                    const dataRows = block.rows.map(row => {
                                        const cells = Array.isArray(row) ? row : Object.values(row);
                                        return new TableRow({
                                            children: cells.map(cell => new TableCell({
                                                children: [new Paragraph({
                                                    children: parseTextWithPlaceholders(String(cell || ''), {}),
                                                    spacing: { after: 40 }
                                                })],
                                                borders,
                                                width: { size: Math.floor(100 / block.headers.length), type: WidthType.PERCENTAGE }
                                            }))
                                        });
                                    });
                                    docChildren.push(new Table({
                                        rows: [headerRow, ...dataRows],
                                        width: { size: 100, type: WidthType.PERCENTAGE }
                                    }));
                                    docChildren.push(new Paragraph({ text: "", spacing: { after: 120 } }));
                                }
                                break;
                            }
                            case 'formula_table': {
                                if (block.headers && block.rows) {
                                    docChildren.push(renderFormulaTable(block, 100));
                                    docChildren.push(new Paragraph({ text: "", spacing: { after: 120 } }));
                                }
                                break;
                            }
                            case 'cover_page': {
                                // Cover page: title, subtitle, company, date, optional logo
                                const spacerBefore = new Paragraph({ text: "", spacing: { after: 800 } });
                                docChildren.push(spacerBefore);

                                // Logo image if provided
                                if (block.logo_url) {
                                    const imgBuffer = await fetchImageAsBuffer(block.logo_url);
                                    if (imgBuffer) {
                                        docChildren.push(new Paragraph({
                                            children: [new ImageRun({
                                                data: imgBuffer,
                                                transformation: { width: block.logo_width || 150, height: block.logo_height || 80 }
                                            })],
                                            alignment: AlignmentType.CENTER,
                                            spacing: { after: 300 }
                                        }));
                                    }
                                }

                                docChildren.push(new Paragraph({
                                    children: [new TextRun({ text: block.title || title || "Report Title", bold: true, size: 56, font: "Calibri" })],
                                    alignment: AlignmentType.CENTER, spacing: { after: 200 }
                                }));
                                if (block.subtitle) {
                                    docChildren.push(new Paragraph({
                                        children: [new TextRun({ text: block.subtitle, size: 32, font: "Calibri", italics: true, color: "555555" })],
                                        alignment: AlignmentType.CENTER, spacing: { after: 400 }
                                    }));
                                }
                                if (block.company) {
                                    const companyRuns = parseTextWithPlaceholders(block.company, { fontSize: 28 });
                                    docChildren.push(new Paragraph({
                                        children: companyRuns,
                                        alignment: AlignmentType.CENTER, spacing: { after: 100 }
                                    }));
                                }
                                if (block.date) {
                                    const dateRuns = parseTextWithPlaceholders(block.date, { fontSize: 24 });
                                    docChildren.push(new Paragraph({
                                        children: dateRuns,
                                        alignment: AlignmentType.CENTER, spacing: { after: 600 }
                                    }));
                                }
                                // Force page break after cover
                                docChildren.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));
                                break;
                            }
                            case 'page_break': {
                                docChildren.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));
                                break;
                            }
                            case 'watermark': {
                                // Watermark is handled at doc-level below — skip in-line
                                break;
                            }
                            case 'image': {
                                const imgUrl = block.url || data.image_url;
                                const isExampleUrl = imgUrl && (imgUrl.includes('example.com') || imgUrl.includes('placeholder') || imgUrl.includes('localhost') || imgUrl.includes('nurotra.com'));

                                if (imgUrl && !isExampleUrl) {
                                    const imgBuffer = await fetchImageAsBuffer(imgUrl);
                                    if (imgBuffer) {
                                        docChildren.push(new Paragraph({
                                            children: [new ImageRun({
                                                data: imgBuffer,
                                                transformation: { width: block.width || 400, height: block.height || 250 }
                                            })],
                                            alignment: AlignmentType.CENTER,
                                            spacing: { after: 80 }
                                        }));
                                        if (block.caption) {
                                            docChildren.push(new Paragraph({
                                                children: [new TextRun({ text: block.caption, italics: true, size: 18, color: "888888" })],
                                                alignment: AlignmentType.CENTER,
                                                spacing: { after: 200 }
                                            }));
                                        }
                                    } else {
                                        // Real fetch failed
                                        docChildren.push(new Paragraph({
                                            children: [new TextRun({ text: `🖼️ [Image Download Failed: ${imgUrl}]`, color: "FF0000", italics: true, size: 20 })],
                                            alignment: AlignmentType.CENTER,
                                            spacing: { after: 200 }
                                        }));
                                    }
                                } else {
                                    // No URL OR it's just an example/placeholder URL
                                    docChildren.push(new Paragraph({
                                        children: [new TextRun({ text: `🖼️ [Image Placeholder: ${block.caption || 'Insert image here'}]`, color: "888888", italics: true, size: 20 })],
                                        alignment: AlignmentType.CENTER,
                                        spacing: { after: 200 }
                                    }));
                                }
                                break;
                            }
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
                    // Backward compat: old flat format
                    const paragraphs = sec.content.split('\n').filter(p => p.trim());
                    paragraphs.forEach(p => {
                        docChildren.push(new Paragraph({
                            children: parseTextWithPlaceholders(p, {}),
                            spacing: { after: 100 }
                        }));
                    });
                }
            }
        }

        // --- Build Header ---
        const docWatermark = watermark || data.watermark;
        const headerText = header || "";
        const footerText = footer || "";

        const headerContent = new Header({
            children: [
                new Paragraph({
                    children: [
                        ...(docWatermark ? [new TextRun({ text: `⚠ ${docWatermark}  `, color: "CC0000", bold: true, size: 18 })] : []),
                        new TextRun({ text: headerText, font: "Calibri", size: 18, color: "555555" })
                    ],
                    alignment: AlignmentType.RIGHT,
                    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } }
                })
            ]
        });

        // --- Build Footer with dynamic page number ---
        const footerParts = footerText.split('{{page_number}}');
        const footerChildren = [];
        if (footerParts.length > 1) {
            const leftText = footerParts[0].replace('{{file_name}}', fileName || '');
            const rightText = footerParts[1].replace('{{file_name}}', fileName || '');
            footerChildren.push(
                new TextRun({ text: leftText, font: "Calibri", size: 18, color: "888888" }),
                new PageNumber({ format: NumberFormat.DECIMAL }),
                new TextRun({ text: rightText, font: "Calibri", size: 18, color: "888888" })
            );
        } else {
            const resolvedFooter = footerText.replace('{{file_name}}', fileName || '');
            footerChildren.push(new TextRun({ text: resolvedFooter, font: "Calibri", size: 18, color: "888888" }));
        }

        const footerContent = new Footer({
            children: [
                new Paragraph({
                    children: footerChildren,
                    alignment: AlignmentType.CENTER,
                    border: { top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } }
                })
            ]
        });

        // --- Build Document ---
        const docConfig = {
            numbering: numberingConfig,
            sections: [{
                properties: {
                    page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }
                },
                headers: { default: headerContent },
                footers: { default: footerContent },
                children: docChildren,
            }],
        };

        // --- Document Protection ---
        if (protection && protection.readOnly) {
            docConfig.settings = {
                documentProtection: {
                    edit: "readOnly",
                    enforcement: true
                }
            };
        }

        const doc = new Document(docConfig);
        const blob = await Packer.toBlob(doc);
        saveAs(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
        return true;
    } catch (error) {
        console.error("Word Gen Error:", error);
        throw error;
    }
};

// ==========================================
// EXCEL SPREADSHEET GENERATOR (Formula + Conditional Formatting Support)
// ==========================================
export const generateExcelSheet = async (data) => {
    try {
        const { fileName, sheets } = data;
        const workbook = new ExcelJS.Workbook();

        if (sheets && Array.isArray(sheets)) {
            sheets.forEach(sheetData => {
                const sheet = workbook.addWorksheet(sheetData.name || 'Sheet 1');

                if (sheetData.headers && Array.isArray(sheetData.headers)) {
                    const headerRow = sheet.addRow(sheetData.headers);
                    headerRow.font = { bold: true };
                }

                if (sheetData.rows && Array.isArray(sheetData.rows)) {
                    sheetData.rows.forEach((rowObj) => {
                        const cells = rowObj.cells || rowObj;
                        const row = sheet.addRow([]);
                        cells.forEach((cell, colIdx) => {
                            const excelCell = row.getCell(colIdx + 1);
                            const val = typeof cell === 'object' ? cell.value : cell;
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
        } else {
            workbook.addWorksheet('Sheet 1');
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        saveAs(blob, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
        return true;
    } catch (error) {
        console.error("Excel Gen Error:", error);
        throw error;
    }
};

// ==========================================
// POWERPOINT PRESENTATION GENERATOR (Rich Layout Engine v2)
// ==========================================

/**
 * HELPER: Simple Lucide Icon Path Data for premium slides
 * (Pre-cached common paths to avoid network calls during export)
 */
const ICON_PATHS = {
    zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    "trending-up": "M23 6l-9.5 9.5-5-5L1 18m22-12h-6m6 0v6",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-14a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75",
    check: "M20 6L9 17l-5-5",
    target: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zM12 14c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z",
    award: "M12 15l-2 5L9 9l11 4-5 2zm0 0l4 8 3-10-10-3 3 5z",
    briefcase: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16m16 0h-4m4 0v-5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v5h4"
};

/**
 * Renders a slide based on its layoutType and data.
 * Supports: 20+ Premium Layouts
 */
const renderSlideByLayout = (slide, slideData, themeData) => {
    const { 
        title, layoutType, bullets, image_url, 
        threeColumns, bigFact, dataGrid, processFlow, 
        dashboardMetrics, funnelStages, quadrants, comparison 
    } = slideData;

    const accentColor = (slideData.accentColor || themeData.accentColor || "#0078D4").replace('#', '');
    const primaryColor = (slideData.primaryColor || themeData.primaryColor || "#2F4F8F").replace('#', '');
    const bgColor = (slideData.backgroundColor || themeData.backgroundColor || "#FFFFFF").replace('#', '');
    const textColor = (bgColor.toLowerCase() === 'ffffff' || bgColor.toLowerCase() === 'f5f5f5') ? '333333' : 'FFFFFF';
    const subTextColor = (textColor === '333333') ? '666666' : 'CCCCCC';
    const fontHeader = themeData.fontFace || "Montserrat";
    const fontBody = themeData.fontBody || "Inter";

    // Apply Background
    slide.background = { fill: bgColor };

    // --- Premium Layouts Switch ---
    switch (layoutType) {
        case 'TITLE_COVER':
            slide.addText(title || "Presentation", {
                x: 0, y: 3.5, w: '100%', h: 1.5,
                fontSize: 48, bold: true, color: primaryColor,
                align: 'center', fontFace: fontHeader
            });
            if (slideData.subtitle) {
                slide.addText(slideData.subtitle, {
                    x: 0, y: 4.8, w: '100%', h: 0.8,
                    fontSize: 24, italic: true, color: subTextColor,
                    align: 'center', fontFace: fontBody
                });
            }
            if (image_url) {
                slide.addImage({ data: image_url, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: 'cover' } });
                // Add a darken overlay for text readability
                slide.addShape(slide.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.6, fill: { color: '000000', transparency: 50 } });
            }
            break;

        case 'SWOT_ANALYSIS': {
            slide.addText(title || "SWOT Analysis", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, bold: true, color: primaryColor, fontFace: fontHeader });
            const swotData = slideData.swot || { s: [], w: [], o: [], t: [] };
            const boxes = [
                { label: 'STRENGTHS', color: '27AE60', x: 0.5, y: 1.2, data: swotData.s },
                { label: 'WEAKNESSES', color: 'E67E22', x: 5.1, y: 1.2, data: swotData.w },
                { label: 'OPPORTUNITIES', color: '2980B9', x: 0.5, y: 3.4, data: swotData.o },
                { label: 'THREATS', color: 'C0392B', x: 5.1, y: 3.4, data: swotData.t }
            ];
            boxes.forEach(box => {
                slide.addShape(slide.ShapeType.rect, { x: box.x, y: box.y, w: 4.4, h: 2.0, fill: { color: bgColor }, line: { color: box.color, width: 2 } });
                slide.addText(box.label, { x: box.x + 0.1, y: box.y + 0.1, fontSize: 16, bold: true, color: box.color, fontFace: fontHeader });
                slide.addText(box.data.map(i => `• ${i}`).join('\n'), {
                    x: box.x + 0.1, y: box.y + 0.4, w: 4.2, h: 1.5,
                    fontSize: 12, color: textColor, fontFace: fontBody, valign: 'top'
                });
            });
            break;
        }

        case 'BIG_FACT':
            slide.addText(title || "", { x: 0, y: 1.5, w: '100%', h: 1, fontSize: 24, color: subTextColor, align: 'center', fontFace: fontBody });
            slide.addText(bigFact?.metric || "99%", {
                x: 0, y: 2.2, w: '100%', h: 1.5,
                fontSize: 90, bold: true, color: accentColor, align: 'center', fontFace: fontHeader
            });
            slide.addText(bigFact?.description || "Significant Result", {
                x: 1, y: 3.8, w: 8, h: 1,
                fontSize: 20, color: textColor, align: 'center', fontFace: fontBody
            });
            break;

        case 'QUOTATION':
            slide.addText('"', { x: 1, y: 1.5, fontSize: 120, color: accentColor, fontFace: fontHeader, transparency: 80 });
            slide.addText(slideData.quote || "The future belongs to those who believe in the beauty of their dreams.", {
                x: 1.5, y: 2.2, w: 7, h: 2,
                fontSize: 28, italic: true, color: textColor, align: 'center', fontFace: fontBody
            });
            slide.addText(`— ${slideData.author || "Eleanor Roosevelt"}`, {
                x: 1, y: 4.2, w: 8, h: 0.5,
                fontSize: 18, bold: true, color: accentColor, align: 'right', fontFace: fontHeader
            });
            break;

        case 'TIMELINE': {
            slide.addText(title || "Timeline", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, bold: true, color: primaryColor, fontFace: fontHeader });
            const events = slideData.timeline || [];
            slide.addShape(slide.ShapeType.line, { x: 0.5, y: 3.5, w: 9, h: 0, line: { color: accentColor, width: 3 } });
            events.forEach((ev, i) => {
                const xPos = 0.5 + (i * (9 / Math.max(events.length, 1)));
                slide.addShape(slide.ShapeType.ellipse, { x: xPos - 0.1, y: 3.4, w: 0.2, h: 0.2, fill: { color: accentColor } });
                slide.addText(ev.date || "", { x: xPos - 0.5, y: 3.1, w: 1, fontSize: 14, bold: true, align: 'center', color: accentColor });
                slide.addText(ev.event || "", { x: xPos - 0.5, y: 3.7, w: 1, fontSize: 10, align: 'center', color: textColor });
            });
            break;
        }

        case 'COMPARISON': {
            slide.addText(title || "Comparison", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, bold: true, color: primaryColor, fontFace: fontHeader });
            const comp = slideData.comparison || { left: { title: "Option A", items: [] }, right: { title: "Option B", items: [] } };
            // Left Box
            slide.addShape(slide.ShapeType.rect, { x: 0.5, y: 1.2, w: 4.4, h: 4, fill: { color: bgColor }, line: { color: accentColor, width: 2 } });
            slide.addText(comp.left.title, { x: 0.6, y: 1.3, w: 4.2, fontSize: 18, bold: true, color: accentColor, fontFace: fontHeader, align: 'center' });
            slide.addText(comp.left.items.map(i => `• ${i}`).join('\n'), { x: 0.7, y: 1.8, w: 4, fontSize: 13, color: textColor, fontFace: fontBody });
            // Right Box
            slide.addShape(slide.ShapeType.rect, { x: 5.1, y: 1.2, w: 4.4, h: 4, fill: { color: bgColor }, line: { color: primaryColor, width: 2 } });
            slide.addText(comp.right.title, { x: 5.2, y: 1.3, w: 4.2, fontSize: 18, bold: true, color: primaryColor, fontFace: fontHeader, align: 'center' });
            slide.addText(comp.right.items.map(i => `• ${i}`).join('\n'), { x: 5.3, y: 1.8, w: 4, fontSize: 13, color: textColor, fontFace: fontBody });
            break;
        }

        case 'FUNNEL': {
            slide.addText(title || "Sales Funnel", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, bold: true, color: primaryColor, fontFace: fontHeader });
            const stages = slideData.funnelStages || [];
            stages.forEach((stage, i) => {
                const width = 6 - (i * 1);
                const xPos = 5 - (width / 2);
                slide.addShape(slide.ShapeType.trapezoid, { 
                    x: xPos, y: 1.2 + (i * 0.8), w: width, h: 0.7, 
                    fill: { color: accentColor, transparency: i * 15 },
                    line: { color: 'FFFFFF', width: 1 }
                });
                slide.addText(`${stage.label}: ${stage.value}`, { 
                    x: xPos, y: 1.2 + (i * 0.8), w: width, h: 0.7, 
                    fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', fontFace: fontBody 
                });
            });
            break;
        }

        case 'DASHBOARD':
        case 'DATA_GRID': {
            slide.addText(title || "Dashboard", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, bold: true, color: primaryColor, fontFace: fontHeader });
            const metrics = slideData.dashboardMetrics || slideData.dataGrid || [];
            metrics.forEach((m, i) => {
                const x = 0.5 + (i % 3) * 3.1;
                const y = 1.2 + Math.floor(i / 3) * 1.5;
                slide.addShape(slide.ShapeType.rect, { x, y: y, w: 2.8, h: 1.2, fill: { color: 'F8F9FA' }, line: { color: accentColor, width: 1 } });
                slide.addText(m.label, { x: x + 0.1, y: y + 0.1, w: 2.6, fontSize: 12, color: subTextColor, fontFace: fontBody });
                slide.addText(String(m.value), { x: x + 0.1, y: y + 0.4, w: 2.6, fontSize: 24, bold: true, color: accentColor, fontFace: fontHeader });
                if (m.trend) {
                    slide.addText(m.trend, { x: x + 0.1, y: y + 0.9, w: 2.6, fontSize: 10, color: m.trend.includes('+') ? '27AE60' : 'C0392B', fontFace: fontBody });
                }
            });
            break;
        }

        case 'MISSION_VISION':
            slide.addText(title || "Mission & Vision", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, bold: true, color: primaryColor, fontFace: fontHeader, align: 'center' });
            slide.addShape(slide.ShapeType.rect, { x: 0.5, y: 1.5, w: 4.4, h: 3, fill: { color: accentColor }, line: { color: 'FFFFFF', width: 2 } });
            slide.addText("OUR MISSION", { x: 0.6, y: 1.6, w: 4.2, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center' });
            slide.addText(slideData.mission || "", { x: 0.7, y: 2.2, w: 4, fontSize: 16, color: 'FFFFFF', align: 'center' });
            slide.addShape(slide.ShapeType.rect, { x: 5.1, y: 1.5, w: 4.4, h: 3, fill: { color: '34495E' }, line: { color: 'FFFFFF', width: 2 } });
            slide.addText("OUR VISION", { x: 5.2, y: 1.6, w: 4.2, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center' });
            slide.addText(slideData.vision || "", { x: 5.3, y: 2.2, w: 4, fontSize: 16, color: 'FFFFFF', align: 'center' });
            break;

        case 'TEAM_PROFILE':
            slide.addText(title || "Our Team", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, bold: true, color: primaryColor, fontFace: fontHeader });
            (slideData.team || []).forEach((member, i) => {
                const x = 0.5 + (i * 2.4);
                slide.addShape(slide.ShapeType.ellipse, { x, y: 1.2, w: 2, h: 2, fill: { color: 'EEEEEE' }, line: { color: accentColor, width: 2 } });
                slide.addText(member.name, { x, y: 3.3, w: 2, fontSize: 16, bold: true, align: 'center' });
                slide.addText(member.role, { x, y: 3.6, w: 2, fontSize: 12, italic: true, align: 'center' });
            });
            break;

        case 'IMAGE_LEFT':
        case 'IMAGE_RIGHT': {
            const isRight = layoutType === 'IMAGE_RIGHT';
            if (image_url) slide.addImage({ data: image_url, x: isRight ? 5.5 : 0.5, y: 1.2, w: 4, h: 4, sizing: { type: 'cover' } });
            slide.addText(title || "Slide", { x: isRight ? 0.5 : 5.5, y: 0.5, w: 4, fontSize: 24, bold: true, color: primaryColor });
            slide.addText(bullets?.join('\n') || "", { x: isRight ? 0.5 : 5.5, y: 1.5, w: 4, fontSize: 14, bullet: true });
            break;
        }

        default:
            slide.addText(title || "Slide", { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, bold: true, color: accentColor, fontFace: fontHeader });
            slide.addShape(slide.ShapeType.line, { x: 0.5, y: 1.0, w: 9, h: 0, line: { color: accentColor, width: 2 } });
            if (bullets && Array.isArray(bullets)) {
                bullets.forEach((bullet, i) => {
                    const bText = typeof bullet === 'object' ? bullet.text : bullet;
                    const bIcon = typeof bullet === 'object' ? bullet.icon : null;
                    slide.addText(bText, {
                        x: bIcon ? 1.0 : 0.7, y: 1.5 + (i * 0.5), w: 8.5, fontSize: 18, color: textColor,
                        bullet: bIcon ? false : true
                    });
                    if (bIcon && ICON_PATHS[bIcon]) {
                        slide.addShape(slide.ShapeType.star5, { x: 0.6, y: 1.55 + (i * 0.5), w: 0.2, h: 0.2, fill: { color: accentColor } });
                    }
                });
            }
            if (image_url && !['IMAGE_LEFT', 'IMAGE_RIGHT', 'TITLE_COVER'].includes(layoutType)) {
                slide.addImage({ data: image_url, x: 7.5, y: 0.5, w: 2, h: 1.5, sizing: { type: 'contain' } });
            }
            break;
    }
};

export const generatePresentation = async (docData) => {
    try {
        const data = JSON.parse(JSON.stringify(docData));
        normalizeContent(data);
        const { fileName, slides, title, theme, accentColor, backgroundColor, fontFace } = data;
        const pres = new pptxgen();
        
        pres.title = title || "Nurotra Intelligence Deck";
        pres.author = "Nurotra Docs Agent";

        const themeData = {
            theme: theme || "Modern",
            accentColor: accentColor || "#0078D4",
            backgroundColor: backgroundColor || "#FFFFFF",
            fontFace: fontFace || "Montserrat"
        };

        if (slides && Array.isArray(slides)) {
            slides.forEach(slideData => {
                const slide = pres.addSlide();
                renderSlideByLayout(slide, slideData, themeData);
            });
        }

        await pres.writeFile({ fileName: fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx` });
        return true;
    } catch (error) {
        console.error("PPT Gen Error:", error);
        throw error;
    }
};
