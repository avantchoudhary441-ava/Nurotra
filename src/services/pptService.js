import pptxgen from "pptxgenjs";

/**
 * Utility to export markdown-style slides to real .pptx files.
 */
export const exportToPPT = (docName, content) => {
    try {
        let pres = new pptxgen();
        const slides = content.split('--- SLIDE ---').filter(s => s.trim() !== '');

        slides.forEach(slideContent => {
            let slide = pres.addSlide();
            const lines = slideContent.split('\n').filter(l => l.trim() !== '');

            let yPos = 0.5;
            lines.forEach(line => {
                if (line.startsWith('# ')) {
                    slide.addText(line.replace('# ', ''), { x: 0.5, y: 0.5, w: '90%', h: 1, fontSize: 32, bold: true, color: '363636' });
                    yPos += 1.2;
                } else {
                    slide.addText(line, { x: 0.5, y: yPos, w: '90%', h: 0.5, fontSize: 18, color: '666666' });
                    yPos += 0.6;
                }
            });
        });

        pres.writeFile({ fileName: docName.endsWith('.pptx') ? docName : `${docName}.pptx` });
    } catch (error) {
        console.error("PPT Export Error:", error);
    }
};
