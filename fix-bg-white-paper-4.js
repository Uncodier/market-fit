const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/components/auth/sections/**/*.{ts,tsx}');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Add more specific fixes for dark:bg-black-paper without bg-[#ffffff]
  // Just ensure we have a fallback for light mode.
  content = content.replace(/dark:bg-black-paper\s+bg-white-paper/g, 'dark:bg-black-paper bg-[#ffffff]');
  
  // Specific to the support carousel
  if (file.includes('SupportCarousel')) {
     content = content.replace(/bg-white-paper/g, 'bg-[#ffffff]');
  }
  
  fs.writeFileSync(file, content, 'utf8');
}
