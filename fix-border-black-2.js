const fs = require('fs');

const file = 'app/components/auth/LandingSections.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/border-black\/\[0.05\]/g, 'border-black/5');
content = content.replace(/border-black\/\[0.03\]/g, 'border-black/5');
content = content.replace(/bg-black\/\[0.05\]/g, 'bg-black/5');
content = content.replace(/bg-black\/\[0.03\]/g, 'bg-black/5');

fs.writeFileSync(file, content, 'utf8');
