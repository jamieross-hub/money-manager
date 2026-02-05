const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '../src/assets/i18n');
const REFERENCE_FILE = 'en.json';

function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function checkConsistency() {
    console.log(`Checking i18n consistency using ${REFERENCE_FILE} as reference...\n`);

    const referencePath = path.join(I18N_DIR, REFERENCE_FILE);
    if (!fs.existsSync(referencePath)) {
        console.error(`Reference file ${REFERENCE_FILE} not found!`);
        process.exit(1);
    }

    const referenceContent = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
    const referenceKeys = new Set(getKeys(referenceContent));

    const files = fs.readdirSync(I18N_DIR).filter(file => file.endsWith('.json') && file !== REFERENCE_FILE);
    
    let hasError = false;

    files.forEach(file => {
        const filePath = path.join(I18N_DIR, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const keys = new Set(getKeys(content));

        const missingKeys = [...referenceKeys].filter(key => !keys.has(key));
        const extraKeys = [...keys].filter(key => !referenceKeys.has(key));

        if (missingKeys.length > 0 || extraKeys.length > 0) {
            console.log(`File: ${file}`);
            if (missingKeys.length > 0) {
                console.error(`  Missing keys (${missingKeys.length}):`);
                missingKeys.forEach(key => console.error(`    - ${key}`));
            }
            if (extraKeys.length > 0) {
                console.error(`  Extra keys (${extraKeys.length}):`);
                extraKeys.forEach(key => console.error(`    - ${key}`));
            }
            console.log('');
            hasError = true;
        }
    });

    if (hasError) {
        console.error('I18n consistency check failed!');
        console.log('Run "npm run i18n:sync" to sync keys with en.json.');
        process.exit(1);
    } else {
        console.log('All i18n files are consistent.');
        process.exit(0);
    }
}

checkConsistency();
