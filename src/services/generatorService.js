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
// POWERPOINT PRESENTATION GENERATOR
// ==========================================
export const generatePresentation = async (docData) => {
    try {
        const data = JSON.parse(JSON.stringify(docData));
        normalizeContent(data);
        const { fileName, slides } = data;
        const pres = new pptxgen();

        if (slides && Array.isArray(slides)) {
            slides.forEach(slideData => {
                const slide = pres.addSlide();
                slide.addText(slideData.title || "Slide", {
                    x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636'
                });
                if (slideData.image_url || data.image_url) {
                    slide.addImage({ path: slideData.image_url || data.image_url, x: '50%', y: '50%', w: 3, h: 2 });
                }
                if (slideData.bullets && Array.isArray(slideData.bullets)) {
                    slide.addText(slideData.bullets.join('\n'), {
                        x: 0.5, y: 1.5, w: '90%', h: '70%', fontSize: 18, color: '666666', bullet: true
                    });
                }
            });
        }

        await pres.writeFile({ fileName: fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx` });
        return true;
    } catch (error) {
        console.error("PPT Gen Error:", error);
        throw error;
    }
};
