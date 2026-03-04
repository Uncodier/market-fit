const fs = require('fs');
const file = 'app/globals.css';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('.neu-card-light-hover')) {
  const hoverStyle = `
  .neu-card-light-hover {
    transition: all 0.3s ease;
  }
  .neu-card-light-hover:hover {
    transform: translateY(-2px);
    box-shadow: 
      10px 10px 20px rgba(0, 0, 0, 0.08), 
      -4px -4px 12px rgba(255, 255, 255, 1), 
      inset 1px 1px 1px rgba(255, 255, 255, 0.9);
  }
`;
  content = content.replace('.bg-white-paper {', hoverStyle + '\n  .bg-white-paper {');
  fs.writeFileSync(file, content, 'utf8');
}
