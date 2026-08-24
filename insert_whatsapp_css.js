const fs = require('fs');
const globalsPath = 'app/globals.css';
let globals = fs.readFileSync(globalsPath, 'utf8');
const whatsappCSS = fs.readFileSync('whatsapp_tint.css', 'utf8');

// The last rule in the red tint section
const target = `.dark .btn-primary-well.btn-tint-red > .btn-primary:hover > .btn-glass-rim {
  background:
    radial-gradient(circle 3.1rem at var(--mx) var(--my), rgb(var(--btn-tint) / 0.4), transparent 54%),
    radial-gradient(circle 2.75rem at var(--gx) var(--gy), rgb(var(--btn-tint) / 0.28), transparent 52%),
    radial-gradient(circle 2.2rem at var(--gx2) var(--gy2), rgb(var(--btn-tint) / 0.14), transparent 50%);
}`;

if (!globals.includes(target)) {
    console.error("Target block not found");
    process.exit(1);
}

const replacement = target + '\n\n/* WhatsApp button tint */\n' + whatsappCSS;
globals = globals.replace(target, replacement);

fs.writeFileSync(globalsPath, globals);
console.log("Success");
