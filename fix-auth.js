const fs = require('fs');

const file = 'app/auth/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/dark:text-white\/[0-9]+ text-slate-500/g, (match) => {
  const parts = match.split(' ');
  return parts[1] + ' ' + parts[0];
});
content = content.replace(/dark:text-white text-slate-900/g, 'text-slate-900 dark:text-white');
content = content.replace(/dark:bg-white\/[0-9]+ bg-black\/[0-9]+/g, (match) => {
  const parts = match.split(' ');
  return parts[1] + ' ' + parts[0];
});
content = content.replace(/dark:border-white\/[0-9]+ border-black\/[0-9]+/g, (match) => {
  const parts = match.split(' ');
  return parts[1] + ' ' + parts[0];
});

fs.writeFileSync(file, content, 'utf8');
