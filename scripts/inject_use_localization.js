const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if t() is used
    if (!content.includes('t(')) return;

    let modified = false;

    // 1. Check if 'use client' is present
    if (!content.includes("'use client'") && !content.includes('"use client"')) {
        content = "'use client';\n\n" + content;
        modified = true;
    }

    // 2. Add import
    if (!content.includes('useLocalization')) {
        // find last import
        const importRegex = /^import\s+.*$/gm;
        let match;
        let lastImportIndex = 0;
        while ((match = importRegex.exec(content)) !== null) {
            lastImportIndex = match.index + match[0].length;
        }

        const importStmt = `\nimport { useLocalization } from "@/app/context/LocalizationContext";\n`;
        if (lastImportIndex > 0) {
            content = content.slice(0, lastImportIndex) + importStmt + content.slice(lastImportIndex);
        } else {
            // put after use client
            const useClientRegex = /^'use client';?\n+/m;
            const ucMatch = content.match(useClientRegex);
            if (ucMatch) {
                const insertIdx = ucMatch.index + ucMatch[0].length;
                content = content.slice(0, insertIdx) + importStmt + content.slice(insertIdx);
            } else {
                content = importStmt + content;
            }
        }
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content);
    }
}

// We also need to inject const { t } = useLocalization(); inside component functions.
// This requires AST manipulation or very smart regex. Let's start with a simpler regex approach for now.
