const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/components/auth/**/*.{ts,tsx}');
files.push('app/auth/page.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/dark:neu-black-chip neu-white-chip-inward/g, 'dark:neu-black-chip-inward neu-white-chip-inward');
  fs.writeFileSync(file, content, 'utf8');
}
