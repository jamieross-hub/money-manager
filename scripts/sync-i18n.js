const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '../src/assets/i18n');
const REFERENCE_FILE = 'en.json';

function deepMerge(target, source) {
    const output = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!(key in target)) {
                output[key] = source[key];
            } else {
                output[key] = deepMerge(target[key], source[key]);
            }
        } else {
            if (!(key in target)) {
                output[key] = source[key];
            }
        }
    }
    // Remove keys that are not in source
    for (const key in output) {
        if (!(key in source)) {
            delete output[key];
        }
    }
    return output;
}

function sortObject(obj, reference) {
    const sorted = {};
    Object.keys(reference).forEach(key => {
        if (key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                sorted[key] = sortObject(obj[key], reference[key]);
            } else {
                sorted[key] = obj[key];
            }
        }
    });
    return sorted;
}

function syncFiles() {
    console.log(`Syncing all i18n files with ${REFERENCE_FILE}...\n`);

    const referencePath = path.join(I18N_DIR, REFERENCE_FILE);
    if (!fs.existsSync(referencePath)) {
        console.error(`Reference file ${REFERENCE_FILE} not found!`);
        process.exit(1);
    }

    const referenceContent = JSON.parse(fs.readFileSync(referencePath, 'utf8'));

    const files = fs.readdirSync(I18N_DIR).filter(file => file.endsWith('.json') && file !== REFERENCE_FILE);

    files.forEach(file => {
        const filePath = path.join(I18N_DIR, file);
        let content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        console.log(`Processing ${file}...`);
        
        // Merge missing keys
        content = deepMerge(content, referenceContent);
        
        // Sort keys to match reference
        content = sortObject(content, referenceContent);

        fs.writeFileSync(filePath, JSON.stringify(content, null, 4) + '\n', 'utf8');
    });

    console.log('\nAll i18n files have been synced.');
}

syncFiles();
