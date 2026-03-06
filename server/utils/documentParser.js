const pdf = require('pdf-parse');
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

        const data = await pdf(buffer);
        return data.text.trim();
    } catch (error) {
        console.error('PDF Parsing Error:', error);
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
