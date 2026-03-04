const fs = require('fs');

const file = 'app/auth/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/className="min-h-screen dark:bg-black-paper bg-white-paper"/, 'className="min-h-screen dark:bg-black-paper bg-[#ffffff]"');

// The main left side which has op-art 
content = content.replace(/className="hidden lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16 relative overflow-hidden dark:bg-black-paper bg-white-paper/, 'className="hidden lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16 relative overflow-hidden dark:bg-black-paper bg-[#f8f9fa]');

// The right side
content = content.replace(/className="flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-16 dark:bg-black-paper bg-white-paper/, 'className="flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-16 dark:bg-black-paper bg-[#ffffff]');

fs.writeFileSync(file, content, 'utf8');
