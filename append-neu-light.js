const fs = require('fs');

const lightStyles = `
  .neu-base-light {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    box-shadow: 
      15px 15px 35px rgba(0, 0, 0, 0.05), 
      -8px -8px 25px rgba(255, 255, 255, 1), 
      inset 1px 1px 2px rgba(255, 255, 255, 0.8), 
      inset -1px -1px 2px rgba(0, 0, 0, 0.05);
    border: none;
  }

  .neu-panel-light {
    background: linear-gradient(135deg, #ffffff 0%, #f1f3f5 100%);
    box-shadow: 
      10px 10px 25px rgba(0, 0, 0, 0.06), 
      -5px -5px 15px rgba(255, 255, 255, 1), 
      inset 1px 1px 1px rgba(255, 255, 255, 0.9), 
      inset -1px -1px 2px rgba(0, 0, 0, 0.03);
    border: none;
  }

  .neu-card-light {
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    box-shadow: 
      6px 6px 14px rgba(0, 0, 0, 0.05), 
      -3px -3px 10px rgba(255, 255, 255, 1), 
      inset 1px 1px 1px rgba(255, 255, 255, 0.9);
    border: none;
  }

  .neu-pressed-light {
    background: #e9ecef;
    box-shadow: 
      inset 5px 5px 12px rgba(0, 0, 0, 0.08), 
      inset -2px -2px 8px rgba(255, 255, 255, 1);
    border: none;
  }

  .neu-skeleton-light {
    background: #e9ecef;
    box-shadow: 
      inset 2px 2px 5px rgba(0, 0, 0, 0.06), 
      inset -1px -1px 2px rgba(255, 255, 255, 1);
    border: none;
  }

  .neu-recessed-light {
    background: #e9ecef;
    box-shadow: 
      inset 4px 4px 10px rgba(0, 0, 0, 0.08), 
      inset -1px -1px 3px rgba(255, 255, 255, 1);
    border: none;
  }

  .neu-mockup-screen-light {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    box-shadow: 
      20px 20px 50px rgba(0, 0, 0, 0.1), 
      -10px -10px 30px rgba(255, 255, 255, 1),
      inset 1px 1px 2px rgba(255, 255, 255, 0.9),
      inset -1px -1px 2px rgba(0, 0, 0, 0.05);
    border: none;
  }

  .neu-button-light {
    background: linear-gradient(135deg, #ffffff 0%, #f1f3f5 100%);
    box-shadow: 
      4px 4px 10px rgba(0, 0, 0, 0.05), 
      -2px -2px 8px rgba(255, 255, 255, 1), 
      inset 1px 1px 1px rgba(255, 255, 255, 0.9);
    border: none;
    transition: all 0.2s ease;
  }

  .neu-button-light:active {
    background: #e9ecef;
    box-shadow: 
      inset 3px 3px 8px rgba(0, 0, 0, 0.08), 
      inset -1px -1px 6px rgba(255, 255, 255, 1);
  }

  .neu-white-chip {
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    box-shadow: 
      8px 8px 16px rgba(0, 0, 0, 0.06), 
      -4px -4px 12px rgba(255, 255, 255, 1), 
      inset 1px 1px 2px rgba(255, 255, 255, 0.9), 
      inset -1px -1px 2px rgba(0, 0, 0, 0.04);
    color: rgba(0, 0, 0, 0.85) !important;
    border: none;
  }

  .neu-white-chip-inward {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    box-shadow: 
      inset 4px 4px 10px rgba(0, 0, 0, 0.08),
      inset -2px -2px 8px rgba(255, 255, 255, 1),
      inset 1px 1px 3px rgba(255, 255, 255, 0.9);
    color: rgba(0, 0, 0, 0.9) !important;
    border: none;
  }

  .bg-white-paper {
    background-color: #ffffff;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 400px 400px;
  }
`;

const file = 'app/globals.css';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('.neu-base-light')) {
  // insert before closing utilities block, or just append it before } if it exists, or just append
  // Actually, wait, let's insert it inside @layer utilities.
  const layerUtilsIdx = content.lastIndexOf('} /* Custom scrollbar styles');
  if (layerUtilsIdx > -1) {
    // try to find where @layer utilities ends
  }
  
  // easier: search for .neu-black-chip-inward { ... } and insert after
  const splitPos = content.indexOf('.neu-auth-input {');
  if (splitPos > -1) {
    content = content.slice(0, splitPos) + lightStyles + '\n' + content.slice(splitPos);
    fs.writeFileSync(file, content);
    console.log('Appended neu-*-light styles successfully');
  } else {
    console.log('Could not find split position');
  }
} else {
  console.log('Already exists');
}
