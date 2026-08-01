"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var ts = __importStar(require("typescript"));
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var TARGET_DIR = path.join(process.cwd(), 'app');
var OUTPUT_FILE = path.join(process.cwd(), 'hardcoded_strings_report.json');
var results = [];
// Attributes that typically contain user-visible text
var TEXT_ATTRIBUTES = new Set(['label', 'placeholder', 'title', 'alt', 'description']);
function walkDir(dir) {
    var files = [];
    var entries = fs.readdirSync(dir, { withFileTypes: true });
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        var fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(walkDir(fullPath));
        }
        else if (entry.isFile() && fullPath.endsWith('.tsx')) {
            files.push(fullPath);
        }
    }
    return files;
}
function hasAlphabeticChars(text) {
    return /[a-zA-Z]/.test(text);
}
// Some texts might just be symbols, numbers, or pure variables. We want to skip them.
function isValidText(text) {
    var trimmed = text.trim();
    if (trimmed.length === 0)
        return false;
    // skip purely symbols/numbers like "-", "/", "123", "•"
    if (!hasAlphabeticChars(trimmed))
        return false;
    // Ignore boolean/variable-like simple texts if they are just placeholders, but JsxText is usually literal.
    return true;
}
function extractHardcodedStrings(filePath) {
    var sourceCode = fs.readFileSync(filePath, 'utf-8');
    var sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
    function visit(node) {
        if (ts.isJsxText(node)) {
            var text = node.getText();
            // JsxText might contain newlines and spaces for indentation
            var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                if (isValidText(line)) {
                    // Check if it's already translated or just a string
                    var lineNum = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
                    results.push({
                        file: path.relative(process.cwd(), filePath),
                        line: lineNum + 1,
                        text: line,
                        type: 'JsxText'
                    });
                }
            }
        }
        else if (ts.isJsxAttribute(node)) {
            var attrName = node.name.getText();
            if (TEXT_ATTRIBUTES.has(attrName) && node.initializer) {
                if (ts.isStringLiteral(node.initializer)) {
                    var text = node.initializer.text;
                    if (isValidText(text)) {
                        var lineNum = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
                        results.push({
                            file: path.relative(process.cwd(), filePath),
                            line: lineNum + 1,
                            text: text,
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
    var files = walkDir(TARGET_DIR);
    console.log("Found ".concat(files.length, " .tsx files."));
    for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
        var file = files_1[_i];
        extractHardcodedStrings(file);
    }
    console.log("Found ".concat(results.length, " hardcoded strings."));
    // Group by file
    var grouped = {};
    for (var _a = 0, results_1 = results; _a < results_1.length; _a++) {
        var res = results_1[_a];
        if (!grouped[res.file]) {
            grouped[res.file] = [];
        }
        grouped[res.file].push(res);
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(grouped, null, 2));
    // Generate Markdown report
    var mdFile = path.join(process.cwd(), 'hardcoded_strings_report.md');
    var mdContent = '# Hardcoded Strings Report\n\n';
    mdContent += "Total files with hardcoded strings: ".concat(Object.keys(grouped).length, "\n");
    mdContent += "Total hardcoded strings: ".concat(results.length, "\n\n");
    for (var _b = 0, _c = Object.entries(grouped); _b < _c.length; _b++) {
        var _d = _c[_b], file = _d[0], items = _d[1];
        mdContent += "## ".concat(file, "\n");
        for (var _e = 0, items_1 = items; _e < items_1.length; _e++) {
            var item = items_1[_e];
            if (item.type === 'JsxAttribute') {
                mdContent += "- Line ".concat(item.line, " [").concat(item.attributeName, "]: \"").concat(item.text, "\"\n");
            }
            else {
                mdContent += "- Line ".concat(item.line, ": \"").concat(item.text, "\"\n");
            }
        }
        mdContent += '\n';
    }
    fs.writeFileSync(mdFile, mdContent);
    console.log("Report generated at ".concat(OUTPUT_FILE, " and ").concat(mdFile));
}
generateReport();
