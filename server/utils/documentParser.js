let pdf = require('pdf-parse');
if (pdf.default) pdf = pdf.default;
const mammoth = require('mammoth');
const axios = require('axios');

/**
 * Extracts text content from a PDF buffer or URL
 */
const parsePDF = async (source) => {
    try {
        let buffer;
        if (typeof source === 'string' && source.startsWith('http')) {
            const response = await axios.get(source, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
        } else {
            buffer = source;
        }

        let data;
        try {
            if (typeof pdf === 'function') {
                data = await pdf(buffer);
            } else if (pdf && typeof pdf.PDFParse === 'function') {
                // Check if it's a class/constructor
                try {
                    data = await new pdf.PDFParse(buffer);
                } catch (e) {
                    if (e.message.includes("Class constructor")) {
                        const instance = new pdf.PDFParse();
                        data = await instance.parse(buffer);
                    } else {
                        throw e;
                    }
                }
            } else if (pdf && typeof pdf.parse === 'function') {
                data = await pdf.parse(buffer);
            } else {
                throw new Error('PDF parsing library is not correctly loaded as a function or recognized object.');
            }
        } catch (innerError) {
            console.error('[PDF Parser] Execution error:', innerError.message);
            throw innerError;
        }
        if (!data || !data.text) {
            console.warn('[PDF Parser] Warning: pdf-parse returned empty text for buffer of size:', buffer.length);
        }
        return data.text ? data.text.trim() : '';
    } catch (error) {
        console.error('PDF Parsing Error (CRITICAL):', error.message);
        return '';
    }
};

/**
 * Extracts text content from a DOCX buffer or URL
 */
const parseDOCX = async (source) => {
    try {
        let buffer;
        if (typeof source === 'string' && source.startsWith('http')) {
            const response = await axios.get(source, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
        } else {
            buffer = source;
        }

        const result = await mammoth.extractRawText({ buffer });
        return result.value.trim();
    } catch (error) {
        console.error('DOCX Parsing Error:', error);
        return '';
    }
};

/**
 * Extracts text content from a Markdown or TXT buffer or URL
 */
const parseText = async (source) => {
    try {
        if (typeof source === 'string' && source.startsWith('http')) {
            const response = await axios.get(source);
            return response.data.trim();
        }
        return source.toString().trim();
    } catch (error) {
        console.error('Text Parsing Error:', error);
        return '';
    }
};

/**
 * Universal Parser Dispatcher
 */
const parseDocument = async (source, mimetype) => {
    if (mimetype === 'application/pdf') {
        return await parsePDF(source);
    } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword'
    ) {
        return await parseDOCX(source);
    } else if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
        return await parseText(source);
    } else {
        console.warn('Unsupported mimetype for parsing:', mimetype);
        return '';
    }
};

module.exports = {
    parsePDF,
    parseDOCX,
    parseText,
    parseDocument
};
