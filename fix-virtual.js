const fs = require('fs');

const file = 'app/components/auth/sections/VirtualEmployeesSection.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/dark:text-white\/50 text-slate-500/g, 'text-slate-500 dark:text-white/50');
content = content.replace(/dark:text-white text-slate-900/g, 'text-slate-900 dark:text-white');
content = content.replace(/dark:text-white\/80 text-slate-500/g, 'text-slate-500 dark:text-white/80');
content = content.replace(/dark:text-white\/40 text-slate-500/g, 'text-slate-500 dark:text-white/40');
content = content.replace(/dark:text-white\/30 text-slate-500/g, 'text-slate-500 dark:text-white/30');

// Fix dark:neu-card neu-card-light-hover logic
content = content.replace(/dark:neu-card neu-card-light dark:neu-card neu-card-light-hover/g, 'dark:neu-card neu-card-light hover:dark:neu-card-hover hover:neu-card-light-hover');

fs.writeFileSync(file, content, 'utf8');
