const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else if (file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(__dirname);
console.log(`Found ${files.length} JS files. Testing load...`);

for (const file of files) {
    const relPath = path.relative(__dirname, file);
    if (file === __filename || relPath === 'server.js') continue;
    
    console.log(`Loading: ${relPath}...`);
    try {
        require(file);
    } catch (err) {
        console.error(`❌ FAILED: ${relPath}`);
        console.error(`   Error: ${err.message}`);
        if (err.code === 'MODULE_NOT_FOUND') {
            console.error(`   Full Stack: ${err.stack}`);
        }
    }
}
console.log('--- Test Complete ---');
