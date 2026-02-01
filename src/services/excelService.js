import * as XLSX from 'xlsx';

/**
 * Utility to export markdown-style tables from document content to real .xlsx files.
 */
export const exportToExcel = (docName, content) => {
    try {
        // 1. Simple Markdown Table Parser
        const lines = content.split('\n').filter(l => l.includes('|'));
        if (lines.length < 2) {
            console.error("No valid table data found for Excel export.");
            return;
        }

        // Extract headers and data
        const headers = lines[0].split('|').map(s => s.trim()).filter(s => s !== '');
        const dataRows = lines.slice(2).map(row => {
            const cells = row.split('|').map(s => s.trim()).filter(s => s !== '');
            return headers.reduce((acc, header, i) => {
                acc[header] = cells[i] || '';
                return acc;
            }, {});
        });

        // 2. Create Workbook
        const worksheet = XLSX.utils.json_to_sheet(dataRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

        // 3. Write and Download
        XLSX.writeFile(workbook, docName.endsWith('.xlsx') ? docName : `${docName}.xlsx`);
    } catch (error) {
        console.error("Excel Export Error:", error);
    }
};
