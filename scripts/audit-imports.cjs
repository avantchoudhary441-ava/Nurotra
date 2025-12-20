const fs = require('fs');
const path = require('path');
// const glob = require('glob');

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });

    return arrayOfFiles.filter(f => f.match(/\.(js|jsx|css)$/));
}

function checkFileExistsWithCase(filepath) {
    const dir = path.dirname(filepath);
    if (dir === '/' || dir === '.') return true;

    try {
        const filenames = fs.readdirSync(dir);
        const basename = path.basename(filepath);
        if (!filenames.includes(basename)) {
            // Find case insensitive match
            const match = filenames.find(f => f.toLowerCase() === basename.toLowerCase());
            if (match) {
                return { error: 'Case mismatch', actual: match, expected: basename };
            }
            return { error: 'Not found' };
        }
        return true;
    } catch (e) {
        return { error: 'Directory not found' };
    }
}

const srcDir = path.join(__dirname, '../src');
const allFiles = getAllFiles(srcDir);
let errorsFound = false;

console.log(`Scanning ${allFiles.length} files for import errors...`);

allFiles.forEach(file => {
    if (file.endsWith('.css')) return; // Don't check imports inside css for now

    const content = fs.readFileSync(file, 'utf8');
    // Match import ... from '...' or import '...'
    const importRegex = /import\s+(?:.*from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
        let importPath = match[1];

        // Ignore packages (no starting . or /)
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;

        // Resolve full path
        let resolvedPath = path.resolve(path.dirname(file), importPath);

        // Try distinct extensions if not provided
        if (!path.extname(resolvedPath)) {
            if (fs.existsSync(resolvedPath + '.jsx')) resolvedPath += '.jsx';
            else if (fs.existsSync(resolvedPath + '.js')) resolvedPath += '.js';
            else if (fs.existsSync(resolvedPath + '.css')) resolvedPath += '.css';
            // else continue; // Might be a directory index, ignoring for simplicity or try /index.js
        }

        const check = checkFileExistsWithCase(resolvedPath);
        if (check !== true && check.error === 'Case mismatch') {
            console.error(`ERROR in ${path.relative(process.cwd(), file)}:`);
            console.error(`  Import: "${importPath}"`);
            console.error(`  Expected: ${check.expected}`);
            console.error(`  Actual:   ${check.actual}`);
            console.error('---');
            errorsFound = true;
        }
    }
});

if (!errorsFound) {
    console.log("No case mismatches found! ✅");
} else {
    console.log("Found case mismatches. Fix these to prevent build errors. ❌");
}
