import * as XLSX from 'xlsx';

/**
 * Utility to export markdown-style tables from document content to real .xlsx files.
 */
/**
 * Utility to export data to real .xlsx files with formula support.
 * @param {string} docName - The filename
 * @param {string} content - Markdown content (fallback)
 * @param {object} rawStructure - The structured JSON from AI (preferred)
 */
export const exportToExcel = (docName, content, rawStructure = null) => {
    try {
        const workbook = XLSX.utils.book_new();
        let worksheet;

        if (rawStructure && (rawStructure.sheets || rawStructure.rows)) {
            // 1. High-Fidelity Export (using internal AI structure)
            const sheetData = rawStructure.sheets?.[0] || rawStructure;
            const rows = sheetData.rows || [];

            // Create worksheet from scratch for formula control
            const ws_data = [];

            // Add custom headers if they exist
            if (sheetData.headers) {
                ws_data.push(sheetData.headers);
            }

            worksheet = XLSX.utils.aoa_to_sheet(ws_data);

            // Manually inject values and formulas to ensure specific data types
            rows.forEach((row, rowIndex) => {
                const rIdx = (sheetData.headers ? rowIndex + 1 : rowIndex);
                const cells = row.cells || row; // Handle both structured and legacy formats

                cells.forEach((cell, colIndex) => {
                    const addr = XLSX.utils.encode_cell({ r: rIdx, c: colIndex });
                    let val = typeof cell === 'object' ? cell.value : cell;
                    let formula = typeof cell === 'object' ? cell.formula : null;

                    // Clean formula (ensure it starts with =)
                    if (formula && !formula.startsWith('=')) formula = `=${formula}`;

                    // Set cell values
                    const cellObj = { v: val };

                    // Try to cast to number if it looks like one, for formula calculation
                    if (!isNaN(val) && val !== '') {
                        cellObj.t = 'n';
                        cellObj.v = parseFloat(val);
                    } else {
                        cellObj.t = 's';
                    }

                    if (formula) {
                        cellObj.f = formula.substring(1); // SheetJS expects formula without leading =
                    }

                    worksheet[addr] = cellObj;
                });
            });

            // Update !ref for the worksheet
            const maxCol = Math.max(...rows.map(r => (r.cells || r).length)) - 1;
            const maxRow = (sheetData.headers ? rows.length : rows.length - 1);
            worksheet['!ref'] = XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: { r: maxRow, c: maxCol }
            });

        } else {
            // 2. Legacy Fallback (Markdown Table Parser)
            const lines = content.split('\n').filter(l => l.includes('|'));
            if (lines.length < 2) return;

            const headers = lines[0].split('|').map(s => s.trim()).filter(s => s !== '');
            const dataRows = lines.slice(2).map(row => {
                const cells = row.split('|').map(s => s.trim()).filter(s => s !== '');
                return headers.reduce((acc, header, i) => {
                    acc[header] = cells[i] || '';
                    return acc;
                }, {});
            });
            worksheet = XLSX.utils.json_to_sheet(dataRows);
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, docName.endsWith('.xlsx') ? docName : `${docName}.xlsx`);
    } catch (error) {
        console.error("Excel Export Error:", error);
    }
};
