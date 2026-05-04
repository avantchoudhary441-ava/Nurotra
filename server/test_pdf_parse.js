try {
    const pdf = require('pdf-parse');
    console.log('SUCCESS: pdf-parse found');
} catch (e) {
    console.error('FAILURE:', e.message);
const pdf = require('pdf-parse');
console.log('PDF Parse Export Type:', typeof pdf);
console.log('PDF Parse Keys:', Object.keys(pdf));
if (pdf.default) {
    console.log('PDF Parse Default Type:', typeof pdf.default);
}
