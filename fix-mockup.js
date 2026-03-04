const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/components/auth/sections/**/*.{ts,tsx}');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/className="([^"]*)neu-mockup-screen([^"]*)"/g, 'className="$1dark:neu-mockup-screen neu-mockup-screen-light$2"');
  
  // also fix some missing text-white dark variants just in case
  
  fs.writeFileSync(file, content, 'utf8');
}
