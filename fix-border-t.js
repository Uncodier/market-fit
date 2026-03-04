const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/components/**/*.{ts,tsx}');

let changed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  newContent = newContent.replace(/border-t border-gray-100 dark:border-gray-800/g, 'border-t dark:border-white/5 border-black/5');
  newContent = newContent.replace(/border-t border-gray-200 dark:border-gray-700/g, 'border-t dark:border-white/5 border-black/5');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Fixed', file);
    changed++;
  }
}
console.log('Total files changed:', changed);
