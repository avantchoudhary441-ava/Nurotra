try {
    const pdf = require('pdf-parse');
    console.log("pdf-parse REQUIRED SUCCESS");
} catch (e) {
    console.error("pdf-parse REQUIRED FAILED");
    console.error(e);
}
