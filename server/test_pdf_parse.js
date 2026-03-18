const pdf = require('pdf-parse');
console.log('PDF Parse Export Type:', typeof pdf);
console.log('PDF Parse Keys:', Object.keys(pdf));
if (pdf.default) {
    console.log('PDF Parse Default Type:', typeof pdf.default);
}
