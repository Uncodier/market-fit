const fs = require('fs');

const file = 'app/components/auth/LandingSections.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/dark:bg-\[#121214\] bg-slate-50/g, 'dark:bg-[#121214] bg-white');

fs.writeFileSync(file, content, 'utf8');
