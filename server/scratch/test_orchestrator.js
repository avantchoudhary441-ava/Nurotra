const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/orchestrator/execute',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk.toString()}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({
  prompt: "create a report on meta vs telegram and use the related images",
  history: []
}));
req.end();
