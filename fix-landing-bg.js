const fs = require('fs');

const file = 'app/components/auth/LandingSections.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/className="relative w-full pt-32 pb-24 border-t dark:border-white\/\[0.04\] border-black\/\[0.04\] dark:bg-black-paper bg-white-paper"/, 'className="relative w-full pt-32 pb-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-[#ffffff]"');

content = content.replace(/className="relative w-full py-24 border-t dark:border-white\/\[0.04\] border-black\/\[0.04\] dark:bg-black-paper bg-white-paper"/, 'className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-[#f8f9fa]"');

content = content.replace(/className="relative w-full py-32 border-t dark:border-white\/\[0.04\] border-black\/\[0.04\] dark:bg-black-paper bg-white-paper overflow-hidden"/, 'className="relative w-full py-32 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-[#ffffff] overflow-hidden"');

fs.writeFileSync(file, content, 'utf8');
