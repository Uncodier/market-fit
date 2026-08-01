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

let filesModified = 0;

for (const [file, items] of Object.entries(grouped)) {
    const filePath = path.join(process.cwd(), file);
    let content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let modified = false;

    // We process items in reverse order by line and text position to avoid shifting line numbers if possible.
    // Actually, simply replacing in the line should be careful if there are multiple occurrences.
    // Better: group items by line.
    const itemsByLine = {};
    for (const item of items) {
        if (!itemsByLine[item.line]) itemsByLine[item.line] = [];
        itemsByLine[item.line].push(item);
    }

    for (const lineNumStr of Object.keys(itemsByLine).sort((a, b) => Number(b) - Number(a))) {
        const lineNum = Number(lineNumStr);
        let lineIdx = lineNum - 1;
        let lineContent = lines[lineIdx];

        // Ensure useTranslation is imported and used
        let itemsInLine = itemsByLine[lineNumStr];
        
        for (const item of itemsInLine) {
            const safeText = item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex
            if (item.type === 'JsxText') {
                // Replace text in JSX: Text -> {t('text')}
                const key = camelCase(item.text);
                // We just use the original text as key for fallback if camelcase is empty
                const finalKey = key || 'unknownKey';
                
                // Match literal text
                const regex = new RegExp(`(?<=>|^|\\s)(${safeText})(?=<|$|\\s)`);
                if (regex.test(lineContent)) {
                    lineContent = lineContent.replace(regex, `{t('${finalKey}')}`);
                    modified = true;
                }
            } else if (item.type === 'JsxAttribute') {
                // Replace text in attribute: attr="Text" -> attr={t('text')}
                const key = camelCase(item.text);
                const finalKey = key || 'unknownKey';
                
                const regex = new RegExp(`${item.attributeName}=["']${safeText}["']`);
                if (regex.test(lineContent)) {
                    lineContent = lineContent.replace(regex, `${item.attributeName}={t('${finalKey}')}`);
                    modified = true;
                }
            }
        }
        lines[lineIdx] = lineContent;
    }

    if (modified) {
        // Also ensure useTranslation is imported if we are using t()
        // but it might be complex to add hook in all components.
        // As a simple start, we just replace. We can let the user or linter handle missing imports, or we try to inject it.
        fs.writeFileSync(filePath, lines.join('\n'));
        filesModified++;
    }
}

console.log(`Modified ${filesModified} files.`);
