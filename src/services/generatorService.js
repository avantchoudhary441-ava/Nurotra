import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import pptxgen from "pptxgenjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ==========================================
// WORD DOCUMENT GENERATOR
// ==========================================
export const generateWordDoc = async (data) => {
    try {
        const { fileName, title, sections } = data; // sections = [{ heading, content }]

        const docChildren = [
            new Paragraph({
                text: title || "New Document",
                heading: HeadingLevel.TITLE,
                spacing: { after: 300 }
            })
        ];

        if (sections && Array.isArray(sections)) {
            sections.forEach(sec => {
                if (sec.heading) {
                    docChildren.push(new Paragraph({
                        text: sec.heading,
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 200, after: 100 }
                    }));
                }
                if (sec.content) {
                    // Split content by newlines to create separate paragraphs
                    const paragraphs = sec.content.split('\n').filter(p => p.trim());
                    paragraphs.forEach(p => {
                        docChildren.push(new Paragraph({
                            children: [new TextRun(p)],
                            spacing: { after: 100 }
                        }));
                    });
                }
            });
        }

        const doc = new Document({
            sections: [{
                properties: {},
                children: docChildren,
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
        return true;
    } catch (error) {
        console.error("Word Gen Error:", error);
        throw error;
    }
};

// ==========================================
// EXCEL SPREADSHEET GENERATOR (Formula Support)
// ==========================================
export const generateExcelSheet = async (data) => {
    try {
        const { fileName, sheets } = data; // sheets = [{ name, rows: [], formulas: {} }]
        const workbook = new ExcelJS.Workbook();

        if (sheets && Array.isArray(sheets)) {
            sheets.forEach(sheetData => {
                const sheet = workbook.addWorksheet(sheetData.name || 'Sheet 1');

                // 1. Process Headers
                if (sheetData.headers && Array.isArray(sheetData.headers)) {
                    const headerRow = sheet.addRow(sheetData.headers);
                    headerRow.font = { bold: true };
                }

                // 2. Process Rows (Handling structured cell objects)
                if (sheetData.rows && Array.isArray(sheetData.rows)) {
                    sheetData.rows.forEach((rowObj) => {
                        const cells = rowObj.cells || rowObj; // Support both structures
                        const row = sheet.addRow([]);

                        cells.forEach((cell, colIdx) => {
                            const excelCell = row.getCell(colIdx + 1);
                            const val = typeof cell === 'object' ? cell.value : cell;
                            const formula = typeof cell === 'object' ? cell.formula : null;

                            // Set value and handle data type for calculation
                            if (!isNaN(val) && val !== '' && typeof val !== 'boolean') {
                                excelCell.value = parseFloat(val);
                            } else {
                                excelCell.value = val;
                            }

                            // Inject formula if present
                            if (formula) {
                                let cleanFormula = formula.startsWith('=') ? formula.substring(1) : formula;
                                excelCell.value = {
                                    formula: cleanFormula,
                                    result: excelCell.value // Fallback to current value if formula fails
                                };
                            }
                        });
                    });
                }
            });
        } else {
            // Default empty sheet
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
export const generatePresentation = async (data) => {
    try {
        const { fileName, slides } = data; // slides = [{ title, bullets: [] }]
        const pres = new pptxgen();

        if (slides && Array.isArray(slides)) {
            slides.forEach(slideData => {
                const slide = pres.addSlide();

                // Title
                slide.addText(slideData.title || "Slide", {
                    x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636'
                });

                // Bullets
                if (slideData.bullets && Array.isArray(slideData.bullets)) {
                    const bulletText = slideData.bullets.map(b => ({ text: b, options: { breakLine: true } }));
                    // Using a simpler approach: just adding text box with bullets
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
