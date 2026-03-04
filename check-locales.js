const fs = require('fs');

const file = fs.readFileSync('app/context/LocalizationContext.tsx', 'utf8');
const esMatches = file.match(/es: \{([\s\S]*?)\},[\s\n]*fr:/);

if (esMatches) {
  const keysMatch = esMatches[1].match(/'([^']+)'\s*:/g) || [];
  const keys = keysMatch.map(k => k.match(/'([^']+)'/)[1]);
  
  const allFiles = require('child_process').execSync('grep -ro "t([\'\\\"].*[\'\\\"])" app/').toString();
  const allTCalls = Array.from(allFiles.matchAll(/t\(['"]([^'"]+)['"]\)/g)).map(m => m[1]);
  
  const missing = [...new Set(allTCalls)].filter(k => !keys.includes(k));
  console.log("Missing keys in ES translation:");
  console.log(missing);
} else {
  console.log("no match for es object");
}
