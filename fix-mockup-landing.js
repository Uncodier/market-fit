const fs = require('fs');

const file = 'app/components/auth/LandingSections.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/neu-mockup-screen/g, 'dark:neu-mockup-screen neu-mockup-screen-light');
fs.writeFileSync(file, content, 'utf8');
