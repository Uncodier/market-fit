const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja'];
const UI_ATTRIBUTES = new Set(['placeholder', 'aria-label', 'title', 'label', 'description', 'triggerText', 'alt']);

function filesBelow(directory, extension) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(filename, extension);
    return extension.test(filename) ? [filename] : [];
  }).sort();
}

/** Explicit dotted entries take precedence over nested entries. */
function flatten(messages) {
  const result = {};
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === 'object' && value) {
      for (const [child, text] of Object.entries(flatten(value))) result[`${key}.${child}`] = text;
    }
  }
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

/** Load each language's own messages; never use the English fallback. */
function loadRawLocales(root) {
  const directory = path.join(root, 'app/context/locales');
  const raw = {};
  for (const locale of SUPPORTED_LOCALES) {
    const filenames = [
      path.join(directory, `${locale}.json`),
      ...filesBelow(path.join(directory, 'workspace', locale), /\.json$/),
      ...filesBelow(path.join(directory, 'screens'), new RegExp(`-${locale}\\.json$`)),
      path.join(directory, 'commerce', `${locale}.json`),
      ...filesBelow(path.join(directory, 'procurement'), new RegExp(`-${locale}\\.json$`)),
    ];
    raw[locale] = Object.assign({}, ...filenames.map((filename) => flatten(JSON.parse(fs.readFileSync(filename, 'utf8')))));
  }
  return raw;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function collectSourceReferences(filename, text, english) {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const keys = new Set();
  const candidates = [];
  const dynamicPatterns = [];
  const addCandidate = (node, value, kind) => {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    // This inventory needs review: brands, example content and symbols are not necessarily translatable UI.
    if (!/[\p{L}]{3}/u.test(trimmed)) return;
    candidates.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind, text: trimmed });
  };
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      if (name === 't' || name === 'documentT' || name === 'checkoutLabelKey') {
        const argument = node.arguments[name === 'documentT' ? 1 : 0];
        if (argument && ts.isStringLiteralLike(argument)) {
          keys.add(argument.text);
          if (name === 'checkoutLabelKey') keys.add(`${argument.text}Service`);
        } else if (argument && ts.isTemplateExpression(argument)) {
          const pattern = `^${escapeRegex(argument.head.text)}${argument.templateSpans.map((span) => `.*${escapeRegex(span.literal.text)}`).join('')}$`;
          dynamicPatterns.push(pattern);
          for (const key of Object.keys(english)) if (new RegExp(pattern).test(key)) keys.add(key);
        }
      }
    }
    // Keys passed through label/status maps are still references even when t() is indirect.
    if (ts.isStringLiteralLike(node) && node.text.includes('.') && english[node.text]) keys.add(node.text);
    if (ts.isJsxText(node)) addCandidate(node, node.text, 'text');
    if (ts.isJsxAttribute(node) && UI_ATTRIBUTES.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) {
      addCandidate(node, node.initializer.text, node.name.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { keys: [...keys].sort(), candidates, dynamicPatterns };
}

function audit(root) {
  const raw = loadRawLocales(root);
  const references = new Map();
  const screens = [];
  for (const filename of filesBelow(path.join(root, 'app'), /\.tsx?$/)) {
    const relative = path.relative(root, filename);
    if (relative.startsWith(`app${path.sep}api${path.sep}`)) continue;
    if (/\.(test|spec)\.tsx?$/.test(filename)) continue;
    const result = collectSourceReferences(filename, fs.readFileSync(filename, 'utf8'), raw.en);
    for (const key of result.keys) references.set(key, [...(references.get(key) || []), relative]);
    if (result.candidates.length) screens.push({ file: relative, candidates: result.candidates });
  }
  const missing = {};
  for (const locale of SUPPORTED_LOCALES) {
    missing[locale] = [...references].filter(([key]) => !raw[locale][key]?.trim()).map(([key, files]) => ({ key, files }));
  }
  return { referencedKeys: references.size, missing, screens };
}

module.exports = { audit, collectSourceReferences, flatten, loadRawLocales };

if (require.main === module) {
  const result = audit(path.resolve(__dirname, '../..'));
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Referenced keys: ${result.referencedKeys}`);
    for (const locale of SUPPORTED_LOCALES) console.log(`${locale}: ${result.missing[locale].length} missing own-language keys`);
    console.log(`Hardcoded UI candidates: ${result.screens.reduce((sum, screen) => sum + screen.candidates.length, 0)} in ${result.screens.length} files (manual review required)`);
    for (const locale of ['en', 'es']) {
      for (const entry of result.missing[locale]) console.log(`[${locale}] ${entry.key}: ${entry.files.join(', ')}`);
    }
  }
  if (process.argv.includes('--check') && ['en', 'es'].some((locale) => result.missing[locale].length)) process.exitCode = 1;
}