/**
 * dashboardExportService.js
 * Handles the conversion of Dashboard JSON structures into 
 * Word (docx), PPT (pptx), and PDF formats.
 */

const { generateWordBuffer, generatePPTBuffer, generatePDFBuffer, generateExcelBuffer } = require('./cloudExportService');

/**
 * Maps dashboard widgets to Word-compatible sections
 */
const mapDashboardToWord = (dashboard) => {
    const { title, widgets } = dashboard;
    const sections = [];

    // Add high-level overview
    sections.push({
        heading: title,
        level: 1,
        blocks: [
            { type: 'paragraph', text: `This analytical dashboard provides a comprehensive overview of ${title}. It combines key performance indicators, data trends, and granular tabular data for strategic decision making.`, style: { italic: true } }
        ]
    });

    // Strategy: Grid to Sequential Sections
    widgets.forEach(widget => {
        const widgetSection = {
            heading: widget.title,
            level: 2,
            blocks: []
        };

        if (widget.type === 'kpi') {
            widgetSection.blocks.push({
                type: 'styled_paragraph',
                text: `${widget.value} (${widget.change})`,
                style: { bold: true, fontSize: 24, align: 'center', color: widget.trend === 'up' ? '2ECC71' : 'E74C3C' }
            });
            widgetSection.blocks.push({
                type: 'paragraph',
                text: `Historical trend analysis indicates a ${widget.trend}ward trajectory.`,
                style: { align: 'center' }
            });
        } else if (widget.type === 'chart') {
            widgetSection.blocks.push({
                type: 'paragraph',
                text: widget.description || `Data visualization illustrating ${widget.title.toLowerCase()}.`
            });
            // Multi-series support: check for valueSecondary
            const hasSecondary = widget.data.some(d => d.valueSecondary !== undefined);
            if (hasSecondary) {
                widgetSection.blocks.push({
                    type: 'table',
                    headers: ['Category', 'Primary Value', 'Secondary Value'],
                    rows: widget.data.map(item => [item.name, item.value, item.valueSecondary || 'N/A'])
                });
            } else {
                widgetSection.blocks.push({
                    type: 'table',
                    headers: ['Category', 'Value'],
                    rows: widget.data.map(item => [item.name, item.value])
                });
            }
        } else if (widget.type === 'map') {
            widgetSection.blocks.push({
                type: 'paragraph',
                text: widget.description || `Geographic distribution of ${widget.title.toLowerCase()}.`
            });
            widgetSection.blocks.push({
                type: 'table',
                headers: ['Region', 'Value', 'Label'],
                rows: widget.data.map(item => [item.region, item.value, item.label || ''])
            });
        } else if (widget.type === 'table') {
            widgetSection.blocks.push({
                type: 'table',
                headers: widget.headers,
                rows: widget.rows
            });
        }

        sections.push(widgetSection);
    });

    return {
        title,
        fileName: `${title.replace(/\s+/g, '_')}_Dashboard.docx`,
        sections,
        header: "Nurotra Intelligence Suite",
        footer: "Dashboard Export | {{file_name}} | Page {{page_number}}"
    };
};

/**
 * Maps dashboard widgets to PPT slides
 */
const mapDashboardToPPT = (dashboard) => {
    const { title, widgets } = dashboard;
    const slides = [];

    // Title Slide
    slides.push({
        title: title,
        layoutType: 'TITLE_COVER'
    });

    // Grouping KPIs into a summary slide
    const kpis = widgets.filter(w => w.type === 'kpi');
    if (kpis.length > 0) {
        slides.push({
            title: "Key Performance Indicators",
            layoutType: 'DATA_GRID',
            dataGrid: kpis.map(k => ({
                label: k.title,
                value: `${k.value} (${k.change})`
            }))
        });
    }

    // Charts get their own slides
    widgets.filter(w => w.type === 'chart').forEach(chart => {
        slides.push({
            title: chart.title,
            layoutType: 'INFOGRAPHIC',
            infographic: {
                metric: chart.data[0]?.value || 'N/A',
                icon: chart.title,
                label: chart.description
            },
            bullets: chart.data.slice(1, 5).map(d => `${d.name}: ${d.value}`)
        });
    });

    // Tables
    widgets.filter(w => w.type === 'table').forEach(table => {
        slides.push({
            title: table.title,
            layoutType: 'BULLETS',
            bullets: table.rows.slice(0, 5).map(r => r.join(' | '))
        });
    });

    // Maps - Geographic data as DATA_GRID slides
    widgets.filter(w => w.type === 'map').forEach(mapWidget => {
        slides.push({
            title: mapWidget.title,
            layoutType: 'DATA_GRID',
            dataGrid: mapWidget.data.map(d => ({
                label: d.region,
                value: `${d.value}${d.label ? ` (${d.label})` : ''}`
            }))
        });
    });

    return {
        title,
        slides,
        theme: 'Modern'
    };
};

/**
 * Export Controller function
 */
const exportDashboard = async (dashboard, format = 'pdf') => {
    try {
        switch (format.toLowerCase()) {
            case 'docx':
                const wordData = mapDashboardToWord(dashboard);
                return await generateWordBuffer(wordData);
            case 'pptx':
                const pptData = mapDashboardToPPT(dashboard);
                return await generatePPTBuffer(pptData);
            case 'xlsx':
            case 'pbi':
                // Power BI / Excel Export: Generate high-fidelity multi-sheet Excel workbook (.xlsx)
                const pbiSheets = [];
                const sheetNames = new Set();
                const getUniqueName = (name) => {
                    let sName = name.substring(0, 31).replace(/[\[\]\?\*\/\\\:]/g, '');
                    let counter = 1;
                    while (sheetNames.has(sName)) {
                        sName = (name.substring(0, 26) + ` (${counter++})`).replace(/[\[\]\?\*\/\\\:]/g, '');
                    }
                    sheetNames.add(sName);
                    return sName;
                };

                // Sheet 1: KPIs
                const kpis = dashboard.widgets.filter(w => w.type === 'kpi');
                if (kpis.length > 0) {
                    pbiSheets.push({
                        name: getUniqueName('KPI Metrics'),
                        headers: ['Metric', 'Value', 'Change', 'Trend'],
                        rows: kpis.map(k => [k.title, k.value, k.change || '', k.trend || ''])
                    });
                }

                // Dedicated Sheets for Charts (Multi-Series support)
                dashboard.widgets.filter(w => w.type === 'chart').forEach((chart, idx) => {
                    const hasSecondary = chart.data.some(d => d.valueSecondary !== undefined);
                    pbiSheets.push({
                        name: getUniqueName(chart.title || `Chart ${idx + 1}`),
                        headers: hasSecondary ? ['Category', 'Primary Value', 'Secondary Value'] : ['Category', 'Value'],
                        rows: chart.data.map(d => hasSecondary ? [d.name, d.value, d.valueSecondary || 0] : [d.name, d.value])
                    });
                });

                // Dedicated Sheets for Maps
                dashboard.widgets.filter(w => w.type === 'map').forEach((mapWidget, idx) => {
                    pbiSheets.push({
                        name: getUniqueName(mapWidget.title || `Map ${idx + 1}`),
                        headers: ['Region', 'Value', 'Label'],
                        rows: mapWidget.data.map(d => [d.region || d.name, d.value, d.label || ''])
                    });
                });

                // Dedicated Sheets for Tables
                dashboard.widgets.filter(w => w.type === 'table').forEach((table, idx) => {
                    pbiSheets.push({
                        name: getUniqueName(table.title || `Table ${idx + 1}`),
                        headers: table.headers,
                        rows: table.rows
                    });
                });

                if (pbiSheets.length === 0) {
                    pbiSheets.push({ name: 'Dashboard', headers: ['ID', 'Info'], rows: [['1', 'No rows found']] });
                }

                return await generateExcelBuffer({ sheets: pbiSheets });
            default: // PDF
                const pdfData = mapDashboardToWord(dashboard); // PDFs currently share Word structuring in cloudExport
                return await generatePDFBuffer(pdfData);
        }
    } catch (error) {
        console.error("[DashboardExportService] Export Failed:", error);
        throw error;
    }
};

module.exports = {
    exportDashboard
};
