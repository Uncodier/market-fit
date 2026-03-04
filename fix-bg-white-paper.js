const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/components/auth/sections/**/*.{ts,tsx}');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/bg-white-paper/g, 'bg-[#ffffff]');
  
  fs.writeFileSync(file, content, 'utf8');
}
