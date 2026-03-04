const fs = require('fs');

const file = 'app/components/auth/sections/SiteFooter.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/dark:dark:bg-white\/10/g, 'dark:bg-white/10');
content = content.replace(/dark:dark:text-white/g, 'dark:text-white');
content = content.replace(/dark:hover:dark:text-white/g, 'dark:hover:text-white');
content = content.replace(/dark:text-white text-slate-900 text-slate-900/g, 'dark:text-white text-slate-900');
content = content.replace(/dark:text-white text-slate-900/g, 'dark:text-white');
content = content.replace(/bg-black\/10 text-black dark:text-white/g, 'bg-black/10 text-black dark:text-white');
content = content.replace(/text-slate-500 hover:text-black dark:hover:text-white/g, 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white');

fs.writeFileSync(file, content, 'utf8');
