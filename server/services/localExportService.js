const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
const pptxgen = require("pptxgenjs");
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const WORKSPACE_BASE = "c:\\Users\\Avant\\OneDrive\\Desktop\\Nurotra\\nurotra workplace";

/**
 * Ensures the target directory exists.
 */
const ensureDirectory = (projectName) => {
    const projectPath = projectName ? path.join(WORKSPACE_BASE, projectName.replace(/[^a-z0-9]/gi, '_')) : WORKSPACE_BASE;
    if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
    }
    return projectPath;
};

/**
 * Automates the saving of a document to the local workspace.
 */
const automateLocalSave = async (docData, projectName) => {
    const { name, type, rawStructure, content } = docData;
    const saveDir = ensureDirectory(projectName);
    const fileName = name.includes('.') ? name : `${name}.${type === 'excel' ? 'xlsx' : type === 'ppt' ? 'pptx' : 'docx'}`;
    const fullPath = path.join(saveDir, fileName);

    try {
        if (type === 'excel') {
            await saveExcel(rawStructure, fullPath);
        } else if (type === 'ppt') {
            await savePPT(rawStructure, fullPath);
        } else {
            await saveWord(rawStructure, fullPath);
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
        }

        if (sheetData.rows) {
            sheetData.rows.forEach(rowObj => {
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
                        excelCell.value = {
                            formula: cleanFormula,
                            result: excelCell.value
                        };
                    }
                });
            });
        }
    });

    await workbook.xlsx.writeFile(fullPath);
};

const saveWord = async (data, fullPath) => {
    const { title, sections } = data;
    const docChildren = [
        new Paragraph({
            text: title || "New Document",
            heading: HeadingLevel.TITLE,
            spacing: { after: 300 }
        })
    ];

    if (sections) {
        sections.forEach(sec => {
            if (sec.heading) {
                docChildren.push(new Paragraph({
                    text: sec.heading,
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 100 }
                }));
            }
            if (sec.content) {
                sec.content.split('\n').filter(p => p.trim()).forEach(p => {
                    docChildren.push(new Paragraph({
                        children: [new TextRun(p)],
                        spacing: { after: 100 }
                    }));
                });
            }
        });
    }

    const doc = new Document({
        sections: [{ children: docChildren }],
    });

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
const openWorkspace = (projectName) => {
    console.log("[LocalSync] Opening workspace for project:", projectName || "Base/Root");
    const projectPath = projectName ? path.join(WORKSPACE_BASE, projectName.replace(/[^a-z0-9]/gi, '_')) : WORKSPACE_BASE;
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

module.exports = { automateLocalSave, openWorkspace };
