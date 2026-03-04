const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/**/*.{ts,tsx}');

let changed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  newContent = newContent.replace(/border-black\/\[0\.02\]/g, 'border-black/5');
  newContent = newContent.replace(/border-black\/\[0\.03\]/g, 'border-black/5');
  newContent = newContent.replace(/border-black\/\[0\.04\]/g, 'border-black/5');
  newContent = newContent.replace(/border-black\/\[0\.05\]/g, 'border-black/5');
  newContent = newContent.replace(/border-black\/\[0\.06\]/g, 'border-black/5');
  newContent = newContent.replace(/border-black\/\[0\.08\]/g, 'border-black/10');
  
  newContent = newContent.replace(/bg-black\/\[0\.02\]/g, 'bg-black/5');
  newContent = newContent.replace(/bg-black\/\[0\.03\]/g, 'bg-black/5');
  newContent = newContent.replace(/bg-black\/\[0\.04\]/g, 'bg-black/5');
  newContent = newContent.replace(/bg-black\/\[0\.05\]/g, 'bg-black/5');
  newContent = newContent.replace(/bg-black\/\[0\.06\]/g, 'bg-black/5');
  newContent = newContent.replace(/bg-black\/\[0\.08\]/g, 'bg-black/10');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Fixed', file);
    changed++;
  }
}
console.log('Total files changed:', changed);
