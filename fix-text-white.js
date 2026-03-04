const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/components/auth/**/*.{ts,tsx}');
files.push('app/auth/page.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace text-slate-900 with text-slate-800 for better visibility in some places, or text-black
  // Actually text-slate-900 is okay. Let's fix the ones that don't have dark: correctly.
  
  content = content.replace(/dark:text-white text-slate-900/g, 'dark:text-white text-slate-900'); // already fine
  
  // Specific fix for the logo bg white/black which was breaking
  content = content.replace(/bg-black-paper/g, 'bg-black-paper');

  fs.writeFileSync(file, content, 'utf8');
}
