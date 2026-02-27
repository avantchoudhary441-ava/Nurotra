const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Diagnostic OK');
});
const PORT = 5005;
server.listen(PORT, () => {
    console.log(`Diagnostic server running on port ${PORT}`);
    // Keep it alive for 10 seconds
    setTimeout(() => {
        console.log('Shutting down diagnostic server');
        process.exit(0);
    }, 10000);
});
