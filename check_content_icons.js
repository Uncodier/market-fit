const fs = require('fs');

const content = fs.readFileSync('app/content/[id]/page.tsx', 'utf8');

const regex = /<p(?:\\s+[^>]*>|>)(?:(?!<\/p>)[\s\S])*?<(?:Cpu|Lightbulb|Clock|Wand2|ArrowRight|Sparkles)\b/g;

let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`Found in app/content/[id]/page.tsx:\n${match[0]}\n`);
}
