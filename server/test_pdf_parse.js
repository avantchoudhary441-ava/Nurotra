try {
    const pdf = require('pdf-parse');
    console.log('SUCCESS: pdf-parse found');
} catch (e) {
    console.error('FAILURE:', e.message);
}
