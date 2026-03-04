const fs = require('fs');

const file = 'app/components/auth/LandingSections.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/className="relative w-full pt-32 pb-24 border-t dark:border-white\/\[0.04\] border-black\/5 dark:bg-black-paper bg-\[#ffffff\]"/, 'className="relative w-full pt-32 pb-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white"');

content = content.replace(/className="relative w-full py-24 border-t dark:border-white\/\[0.04\] border-black\/5 dark:bg-black-paper bg-\[#ffffff\]"/, 'className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white"');

content = content.replace(/className="relative w-full py-32 border-t dark:border-white\/\[0.04\] border-black\/5 dark:bg-black-paper bg-\[#ffffff\] overflow-hidden"/, 'className="relative w-full py-32 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white overflow-hidden"');

fs.writeFileSync(file, content, 'utf8');

const fileAuth = 'app/auth/page.tsx';
let contentAuth = fs.readFileSync(fileAuth, 'utf8');

contentAuth = contentAuth.replace(/className="min-h-screen dark:bg-black-paper bg-\[#ffffff\]"/, 'className="min-h-screen dark:bg-black-paper bg-white"');
contentAuth = contentAuth.replace(/className="hidden lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16 relative overflow-hidden dark:bg-black-paper bg-\[#f8f9fa\]/, 'className="hidden lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16 relative overflow-hidden dark:bg-black-paper bg-[#f8f9fa]');
contentAuth = contentAuth.replace(/className="flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-16 dark:bg-black-paper bg-\[#ffffff\]/, 'className="flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-16 dark:bg-black-paper bg-white');

fs.writeFileSync(fileAuth, contentAuth, 'utf8');

