const fs = require('fs');

const file = 'app/auth/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<GitHubIcon size=\{16\} color="#fff" \/>/, '<GitHubIcon size={16} color={isDark ? "#fff" : "#000"} />');

fs.writeFileSync(file, content, 'utf8');
