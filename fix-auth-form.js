const fs = require('fs');
const file = 'app/components/auth/auth-form.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/neu-auth-input-light dark:neu-auth-input/g, 'dark:neu-auth-input neu-auth-input-light');
content = content.replace(/neu-auth-btn/g, 'dark:neu-auth-btn neu-auth-btn-light');

fs.writeFileSync(file, content, 'utf8');

const globalCss = 'app/globals.css';
let css = fs.readFileSync(globalCss, 'utf8');
if (!css.includes('.neu-auth-btn-light')) {
  css = css.replace('.neu-auth-input-light {', `.neu-auth-btn-light {
  box-shadow: 
    inset 2px 2px 6px rgba(0, 0, 0, 0.08),
    inset -1px -1px 3px rgba(255, 255, 255, 0.5) !important;
}
.neu-auth-btn-light:hover {
  box-shadow: 
    4px 4px 14px rgba(0, 0, 0, 0.15),
    -2px -2px 10px rgba(255, 255, 255, 0.8) !important;
}
.neu-auth-btn-light:active {
  box-shadow: 
    inset 3px 3px 8px rgba(0, 0, 0, 0.15),
    inset -2px -2px 4px rgba(255, 255, 255, 0.4) !important;
}
.neu-auth-input-light {`);
  fs.writeFileSync(globalCss, css, 'utf8');
}

