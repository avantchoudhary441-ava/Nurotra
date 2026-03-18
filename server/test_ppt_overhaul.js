const path = require('path');
const fs = require('fs');

// Mock getContrastColor if needed or import from localExportService
const getContrastColor = (hexcolor) => {
    if (!hexcolor) return '#000000';
    hexcolor = hexcolor.replace("#", "");
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '000000' : 'FFFFFF';
};

// Import the service logic (we'll just use the code we wrote to test)
// For testing purposes, we'll manually require the dependencies
const pptxgen = require('pptxgenjs');

// Copy the getPPTTheme from the service
const getPPTTheme = (themeName) => {
    const themes = {
        'Modern': { color: '1A1A1A', accent: '00D2D3', font: 'Montserrat', bg: 'FFFFFF', altBg: 'F5F6FA', headingFont: 'Montserrat', bodyFont: 'Open Sans' },
        'Corporate': { color: '2D3436', accent: '0984E3', font: 'Helvetica', bg: 'FFFFFF', altBg: 'ECF0F1', headingFont: 'Helvetica-Bold', bodyFont: 'Helvetica' },
        'Dark': { color: 'FFFFFF', accent: '00CEC9', font: 'Montserrat', bg: '1E272E', altBg: '2D3436', headingFont: 'Montserrat', bodyFont: 'Open Sans' },
        'Creative': { color: '2D3436', accent: '6C5CE7', font: 'Montserrat', bg: 'FFFFFF', altBg: 'F8F9FA', headingFont: 'Montserrat', bodyFont: 'Montserrat' },
        'Luxury': { color: 'D4AF37', accent: 'D4AF37', font: 'Playfair Display', bg: '1A1A1A', altBg: '2D3436', headingFont: 'Playfair Display', bodyFont: 'Lora' },
        'Vibrant': { color: 'FFFFFF', accent: 'FF007F', font: 'Montserrat', bg: '4834D4', altBg: '686DE0', headingFont: 'Montserrat', bodyFont: 'Open Sans' }
    };
    return themes[themeName] || themes['Modern'];
};

// The savePPT logic
const runTest = async () => {
    const data = {
        theme: 'Dark',
        slides: [
            { title: "Nurotra Professional Overhaul", layoutType: 'TITLE_COVER' },
            {
                title: "Market Performance",
                layoutType: 'BULLETS',
                chart_config: {
                    type: 'bar',
                    title: 'Q1 Revenue Growth',
                    data: [{
                        name: 'Growth',
                        labels: ['Jan', 'Feb', 'Mar'],
                        values: [45, 60, 85]
                    }]
                }
            },
            {
                title: "Core Pillars",
                layoutType: 'THREE_COLUMNS',
                threeColumns: [
                    { title: "Precision", text: "Pixel-perfect alignment and professional layouts." },
                    { title: "Dynamic", text: "Component-based architecture for infinite flexibility." },
                    { title: "Business", text: "Tailored for high-end executive presentations." }
                ]
            },
            {
                title: "SWOT Analysis",
                layoutType: 'SWOT',
                bullets: [
                    ["Advanced Engine", "AI Integration"],
                    ["Complexity", "Data Density"],
                    ["Global Market", "New Verticals"],
                    ["Competitors", "Tech Shifts"]
                ]
            },
            {
                title: "Roadmap 2026",
                layoutType: 'TIMELINE',
                timeline_steps: ["Foundation", "Scaling", "Optimization", "Dominance"]
            },
            {
                title: "Key Metrics",
                layoutType: 'DATA_GRID',
                dataGrid: [
                    { label: "Active Users", value: "2.4M" },
                    { label: "Growth Rate", value: "+145%" },
                    { label: "Retention", value: "92%" },
                    { label: "Revenue", value: "$42M" }
                ]
            },
            {
                title: "Visual Narrative",
                layoutType: 'IMAGE_SPLIT',
                image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
                bullets: ["Engaging visuals", "Professional typography", "Clean grid system"]
            }
        ]
    };

    const pres = new pptxgen();
    const theme = getPPTTheme(data.theme);
    const accent = theme.accent.replace('#', '');
    const bg = theme.bg.replace('#', '');

    pres.defineSlideMaster({
        title: "MASTER_SLIDE",
        background: { fill: bg },
        objects: [
            { rect: { x: 0, y: 0, w: 0.1, h: '100%', fill: { color: accent } } },
            { text: { text: "Nurotra Intelligence Suite", options: { x: 7.5, y: 7.1, w: 2.0, fontSize: 10, color: accent, italic: true, align: 'right' } } }
        ]
    });

    data.slides.forEach(s => {
        const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
        const layout = s.layoutType || 'BULLETS';
        const contrastTextColor = getContrastColor('#' + bg);

        const addTitle = (titleText, opts = {}) => {
            slide.addText(String(titleText || "Slide"), {
                x: opts.x || 0.5, y: opts.y || 0.4, w: opts.w || '90%', h: opts.h || 0.8,
                fontSize: opts.fontSize || 36, bold: true, color: accent,
                fontFace: theme.headingFont, align: opts.align || 'left', valign: 'top'
            });
            if (!opts.noUnderline) {
                slide.addShape(pres.ShapeType.rect, { x: opts.x || 0.5, y: (opts.y || 0.4) + 0.7, w: 3.0, h: 0.05, fill: { color: accent, alpha: 30 } });
            }
        };

        const addText = (textValue, opts = {}) => {
            const options = {
                x: opts.x || 0.5, y: opts.y || 1.5, w: opts.w || '90%', h: opts.h || 5.0,
                fontSize: opts.fontSize || 20, color: contrastTextColor,
                fontFace: theme.bodyFont, lineSpacing: 36, valign: 'top'
            };
            if (Array.isArray(textValue)) {
                slide.addText(textValue.map(b => ({ text: String(b), options: { bullet: true, margin: 15, indent: 20 } })), options);
            } else {
                slide.addText(String(textValue), options);
            }
        };

        if (s.chart_config) {
            const c = s.chart_config;
            slide.addChart(pres.ChartType[c.type] || pres.ChartType.bar, c.data, {
                x: c.x || 0.5, y: c.y || 1.8, w: c.w || 9, h: c.h || 4.5,
                title: c.title, showTitle: true,
                chartColors: [accent, '555555', '999999'],
                legendPos: 'b'
            });
        }

        switch (layout) {
            case 'TITLE_COVER':
                slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '40%', h: '100%', fill: accent });
                slide.addText(String(s.title || ""), {
                    x: '45%', y: '35%', w: '50%', h: '20%',
                    fontSize: 54, bold: true, color: accent,
                    fontFace: theme.headingFont, align: 'left', valign: 'middle'
                });
                break;
            case 'THREE_COLUMNS':
                addTitle(s.title);
                if (s.threeColumns) {
                    s.threeColumns.slice(0, 3).forEach((col, idx) => {
                        const x = 0.5 + (idx * 3.1);
                        slide.addShape(pres.ShapeType.rect, { x: x, y: 1.5, w: 2.8, h: 4.5, fill: 'FFFFFF', line: { color: accent, width: 1 } });
                        slide.addText(String(col.title || ""), { x: x + 0.1, y: 1.7, w: 2.6, fontSize: 18, bold: true, color: accent, align: 'center', fontFace: theme.headingFont });
                        slide.addText(String(col.text || ""), { x: x + 0.1, y: 2.2, w: 2.6, fontSize: 14, color: contrastTextColor, align: 'center', fontFace: theme.bodyFont });
                    });
                }
                break;
            case 'TIMELINE':
                addTitle(s.title);
                const steps = s.timeline_steps || [];
                slide.addShape(pres.ShapeType.line, { x: 0.5, y: 4.0, w: 9.0, h: 0, line: { color: accent, width: 3 } });
                steps.slice(0, 5).forEach((step, idx) => {
                    const x = 0.5 + (idx * 1.8);
                    slide.addShape(pres.ShapeType.ellipse, { x: x + 0.7, y: 3.8, w: 0.4, h: 0.4, fill: accent });
                    slide.addText(String(step), { x: x, y: idx % 2 === 0 ? 3.0 : 4.5, w: 1.8, fontSize: 12, color: contrastTextColor, align: 'center', fontFace: theme.bodyFont });
                });
                break;
            case 'DATA_GRID':
                addTitle(s.title);
                if (s.dataGrid) {
                    s.dataGrid.slice(0, 8).forEach((item, idx) => {
                        const row = Math.floor(idx / 4);
                        const col = idx % 4;
                        const x = 0.5 + (col * 2.3);
                        const y = 1.5 + (row * 2.2);
                        slide.addShape(pres.ShapeType.rect, { x, y, w: 2.1, h: 1.8, fill: 'F8F9FA', line: { color: 'CCCCCC' } });
                        slide.addText(String(item.label || ""), { x: x + 0.1, y: y + 0.2, w: 1.9, fontSize: 12, bold: true, color: accent, fontFace: theme.headingFont });
                        slide.addText(String(item.value || ""), { x: x + 0.1, y: y + 0.8, w: 1.9, fontSize: 24, bold: true, color: contrastTextColor, fontFace: theme.bodyFont });
                    });
                }
                break;
            case 'SWOT':
                addTitle("SWOT Analysis", { align: 'center' });
                const swot = ["STRENGTHS", "WEAKNESSES", "OPPORTUNITIES", "THREATS"];
                const swotColors = [accent, 'E74C3C', '2ECC71', 'F1C40F'];
                swot.forEach((lab, i) => {
                    const x = 0.5 + (i % 2) * 4.5;
                    const y = 1.6 + Math.floor(i / 2) * 2.6;
                    slide.addShape(pres.ShapeType.rect, { x, y, w: 4.3, h: 2.3, fill: 'FFFFFF', line: { color: swotColors[i], width: 2 } });
                    slide.addText(lab, { x: x + 0.2, y: y + 0.1, w: 3.9, fontSize: 20, bold: true, color: swotColors[i], fontFace: theme.headingFont });
                    if (s.bullets && s.bullets[i]) {
                        slide.addText(s.bullets[i].join('\n'), { x: x + 0.2, y: y + 0.6, w: 3.9, fontSize: 14, color: contrastTextColor, fontFace: theme.bodyFont });
                    }
                });
                break;
            case 'IMAGE_SPLIT':
                const splitPos = 40;
                slide.addImage({ path: s.image_url, x: 0, y: 0, w: splitPos / 10, h: '100%', opacity: 100 });
                slide.addText(String(s.title || ""), { x: '45%', y: '20%', w: '50%', fontSize: 32, bold: true, color: accent, fontFace: theme.headingFont });
                addText(s.bullets || "", { x: '45%', y: '35%', w: '50%' });
                break;
            default:
                addTitle(s.title);
                addText(s.bullets || "");
                break;
        }
    });

    const exportPath = path.join(__dirname, 'test_output_overhaul.pptx');
    await pres.writeFile({ fileName: exportPath });
    console.log(`PPT generated successfully at: ${exportPath}`);
};

runTest().catch(console.error);
