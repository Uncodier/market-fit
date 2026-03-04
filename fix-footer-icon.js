const fs = require('fs');

const file = 'app/components/auth/sections/SiteFooter.tsx';
let content = fs.readFileSync(file, 'utf8');

// We need to bring useTheme into the component or just check the HTML tree.
// Wait, `useTheme()` is already there!
content = content.replace(/export function SiteFooter\(\) \{/, 'export function SiteFooter() {\n  const { theme } = useTheme();\n  const isDark = theme === "dark";');

content = content.replace(/<TwitterIcon size=\{18\} color="#fff"/g, '<TwitterIcon size={18} color={isDark ? "#fff" : "#000"}');
content = content.replace(/<LinkedInIcon size=\{18\} color="#fff"/g, '<LinkedInIcon size={18} color={isDark ? "#fff" : "#000"}');
content = content.replace(/<GitHubIcon size=\{18\} color="#fff"/g, '<GitHubIcon size={18} color={isDark ? "#fff" : "#000"}');

fs.writeFileSync(file, content, 'utf8');
