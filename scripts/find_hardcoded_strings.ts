import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIR = path.join(process.cwd(), 'app');
const OUTPUT_FILE = path.join(process.cwd(), 'hardcoded_strings_report.json');

interface HardcodedString {
    file: string;
    line: number;
    text: string;
    type: 'JsxText' | 'JsxAttribute';
    attributeName?: string;
}

const results: HardcodedString[] = [];

// Attributes that typically contain user-visible text
const TEXT_ATTRIBUTES = new Set(['label', 'placeholder', 'title', 'alt', 'description']);

function walkDir(dir: string): string[] {
    let files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(walkDir(fullPath));
        } else if (entry.isFile() && fullPath.endsWith('.tsx')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

function hasAlphabeticChars(text: string): boolean {
    return /[a-zA-Z]/.test(text);
}

// Some texts might just be symbols, numbers, or pure variables. We want to skip them.
function isValidText(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;
    // skip purely symbols/numbers like "-", "/", "123", "•"
    if (!hasAlphabeticChars(trimmed)) return false;
    // Ignore boolean/variable-like simple texts if they are just placeholders, but JsxText is usually literal.
    return true;
}

function extractHardcodedStrings(filePath: string) {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
    );

    function visit(node: ts.Node) {
        if (ts.isJsxText(node)) {
            const text = node.getText();
            // JsxText might contain newlines and spaces for indentation
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            for (const line of lines) {
                if (isValidText(line)) {
                    // Check if it's already translated or just a string
                    const { line: lineNum } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    results.push({
                        file: path.relative(process.cwd(), filePath),
                        line: lineNum + 1,
                        text: line,
                        type: 'JsxText'
                    });
                }
            }
        } else if (ts.isJsxAttribute(node)) {
            const attrName = node.name.getText();
            if (TEXT_ATTRIBUTES.has(attrName) && node.initializer) {
                if (ts.isStringLiteral(node.initializer)) {
                    const text = node.initializer.text;
                    if (isValidText(text)) {
                        const { line: lineNum } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                        results.push({
                            file: path.relative(process.cwd(), filePath),
                            line: lineNum + 1,
                            text,
                            type: 'JsxAttribute',
                            attributeName: attrName
                        });
                    }
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
}

function generateReport() {
    console.log('Scanning files...');
    const files = walkDir(TARGET_DIR);
    console.log(`Found ${files.length} .tsx files.`);

    for (const file of files) {
        extractHardcodedStrings(file);
    }

    console.log(`Found ${results.length} hardcoded strings.`);

    // Group by file
    const grouped: Record<string, HardcodedString[]> = {};
    for (const res of results) {
        if (!grouped[res.file]) {
            grouped[res.file] = [];
        }
        grouped[res.file].push(res);
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(grouped, null, 2));
    
    // Generate Markdown report
    const mdFile = path.join(process.cwd(), 'hardcoded_strings_report.md');
    let mdContent = '# Hardcoded Strings Report\n\n';
    mdContent += `Total files with hardcoded strings: ${Object.keys(grouped).length}\n`;
    mdContent += `Total hardcoded strings: ${results.length}\n\n`;

    for (const [file, items] of Object.entries(grouped)) {
        mdContent += `## ${file}\n`;
        for (const item of items) {
            if (item.type === 'JsxAttribute') {
                mdContent += `- Line ${item.line} [${item.attributeName}]: "${item.text}"\n`;
            } else {
                mdContent += `- Line ${item.line}: "${item.text}"\n`;
            }
        }
        mdContent += '\n';
    }

    fs.writeFileSync(mdFile, mdContent);
    console.log(`Report generated at ${OUTPUT_FILE} and ${mdFile}`);
}

generateReport();