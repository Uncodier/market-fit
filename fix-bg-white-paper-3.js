const fs = require('fs');
const file = 'app/auth/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/bg-white-paper/g, 'bg-[#ffffff]');
fs.writeFileSync(file, content, 'utf8');
