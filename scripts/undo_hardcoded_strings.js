const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'hardcoded_strings_report.json');
const grouped = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

function snakeCase(str) {
    return str.replace(/\W+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function camelCase(str) {
    const s = snakeCase(str);
    return s.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

let filesRestored = 0;

for (const [file, items] of Object.entries(grouped)) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let modified = false;

    const itemsByLine = {};
    for (const item of items) {
        if (!itemsByLine[item.line]) itemsByLine[item.line] = [];
        itemsByLine[item.line].push(item);
    }

    for (const lineNumStr of Object.keys(itemsByLine).sort((a, b) => Number(b) - Number(a))) {
        const lineNum = Number(lineNumStr);
        let lineIdx = lineNum - 1;
        let lineContent = lines[lineIdx];

        let itemsInLine = itemsByLine[lineNumStr];
        
        for (const item of itemsInLine) {
            if (item.type === 'JsxText') {
                const key = camelCase(item.text);
                const finalKey = key || 'unknownKey';
                
                // We injected `{t('finalKey')}`. We want to replace it back with `item.text`.
                // Be careful, it could be {t("key")} or {t('key')}. My script used {t('key')}.
                const regex = new RegExp(`\\{t\\(['"]${finalKey}['"]\\)\\}`);
                if (regex.test(lineContent)) {
                    lineContent = lineContent.replace(regex, item.text);
                    modified = true;
                }
            } else if (item.type === 'JsxAttribute') {
                const key = camelCase(item.text);
                const finalKey = key || 'unknownKey';
                
                // We injected attr={t('finalKey')}. We want to replace it back with attr="item.text".
                const regex = new RegExp(`${item.attributeName}=\\{t\\(['"]${finalKey}['"]\\)\\}`);
                if (regex.test(lineContent)) {
                    lineContent = lineContent.replace(regex, `${item.attributeName}="${item.text}"`);
                    modified = true;
                }
            }
        }
        lines[lineIdx] = lineContent;
    }

    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'));
        filesRestored++;
    }
}

console.log(`Restored ${filesRestored} files.`);
