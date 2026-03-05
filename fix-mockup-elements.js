const fs = require('fs');
const file = 'app/components/auth/sections/MockupSlider.tsx';
let content = fs.readFileSync(file, 'utf8');

// The lines we want to delete contain this specific pattern:
// rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px
// Or generally matching repeating-linear-gradient with 255,255,255

const lines = content.split('\n');
const newLines = lines.filter(line => !line.includes('rgba(255,255,255,0.1)_8px'));

fs.writeFileSync(file, newLines.join('\n'));
console.log(`Removed ${lines.length - newLines.length} lines.`);
