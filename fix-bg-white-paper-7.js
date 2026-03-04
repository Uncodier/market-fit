const fs = require('fs');

const file = 'app/globals.css';
let content = fs.readFileSync(file, 'utf8');

// The current background for neu-panel-light is missing border dark mode adjustments in some areas, but mainly:
// "bg-[#ffffff]" was added. Let's make sure our "paper-texture-overlay" is properly visible but not intrusive.
// Let's modify globals.css for paper-texture-overlay
content = content.replace(/\.paper-texture-overlay \{[^}]+\}/, `
  .paper-texture-overlay {
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.02'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 400px 400px;
    pointer-events: none;
  }
`);

fs.writeFileSync(file, content, 'utf8');
