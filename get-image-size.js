const fs = require('fs');

function getDimensions(file) {
  const buffer = fs.readFileSync(file);
  // PNG signature is 8 bytes. IHDR chunk starts at byte 12.
  // Width is 4 bytes at offset 16, height is 4 bytes at offset 20.
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  console.log(`${file}: ${width}x${height}`);
}

getDimensions('/Users/prado/.cursor/projects/Users-prado-Desktop-Proyectos-Uncodie-Code-market-fit/assets/browser-screenshot-db36a89d-fcb1-4edb-a49a-55cc50ede4cc.png');
