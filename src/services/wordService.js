import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Utility to export markdown-style content to real .docx files.
 */
export const exportToWord = (docName, content) => {
    try {
        const sections = content.split('\n\n').map(block => {
            if (block.startsWith('# ')) {
                return new Paragraph({
                    text: block.replace('# ', ''),
                    heading: HeadingLevel.HEADING_1,
                });
            } else if (block.startsWith('## ')) {
                return new Paragraph({
                    text: block.replace('## ', ''),
                    heading: HeadingLevel.HEADING_2,
                });
            } else {
                return new Paragraph({
                    children: [new TextRun(block)],
                });
            }
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: sections,
            }],
        });

        Packer.toBlob(doc).then(blob => {
            saveAs(blob, docName.endsWith('.docx') ? docName : `${docName}.docx`);
        });
    } catch (error) {
        console.error("Word Export Error:", error);
    }
};
