const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/components/auth/**/*.{ts,tsx}');
files.push('app/auth/page.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/border-black\/\[0.04\]/g, 'border-black/5');
  content = content.replace(/border-black\/\[0.02\]/g, 'border-black/5');
  content = content.replace(/border-black\/\[0.05\]/g, 'border-black/10');
  content = content.replace(/border-black\/\[0.03\]/g, 'border-black/5');
  content = content.replace(/border-black\/\[0.08\]/g, 'border-black/10');
  
  content = content.replace(/bg-black\/\[0.04\]/g, 'bg-black/5');
  content = content.replace(/bg-black\/\[0.02\]/g, 'bg-black/5');
  content = content.replace(/bg-black\/\[0.05\]/g, 'bg-black/10');
  content = content.replace(/bg-black\/\[0.03\]/g, 'bg-black/5');
  content = content.replace(/bg-black\/\[0.08\]/g, 'bg-black/10');
  
  fs.writeFileSync(file, content, 'utf8');
}
