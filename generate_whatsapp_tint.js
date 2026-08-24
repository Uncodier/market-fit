const fs = require('fs');
let css = fs.readFileSync('red_tint.css', 'utf8');

// Replace class names
css = css.replace(/\.btn-tint-red/g, '.btn-tint-whatsapp');

// Light mode replaces
css = css.replace(/--btn-tint: 248 113 113;/g, '--btn-tint: 37 211 102;');
css = css.replace(/--btn-fill: 152 36 42;/g, '--btn-fill: 18 140 126;');
css = css.replace(/rgb\(168 40 48 \/ 0\.45\)/g, 'rgb(18 140 126 / 0.45)');
css = css.replace(/rgb\(80 12 16 \/ 0\.55\)/g, 'rgb(7 94 84 / 0.55)');

// Dark mode replaces
css = css.replace(/--btn-tint: 252 180 180;/g, '--btn-tint: 112 255 156;');
css = css.replace(/--btn-fill: 58 30 34;/g, '--btn-fill: 7 94 84;');
css = css.replace(/rgb\(58 30 34 \/ 0\.4\)/g, 'rgb(7 94 84 / 0.4)');
css = css.replace(/rgb\(30 14 16 \/ 0\.45\)/g, 'rgb(2 50 40 / 0.45)');

fs.writeFileSync('whatsapp_tint.css', css);
