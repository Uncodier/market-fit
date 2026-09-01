const fs = require('fs');

const files = [
  'app/context/site-set-current.ts',
  'app/context/site-update-settings.ts',
  'app/api/revenue/route.ts',
  'app/api/sales/route.ts',
  'app/api/active-users/route.ts',
  'app/api/cac/route.ts',
  'app/api/cpl/route.ts',
  'app/api/roi/route.ts',
  'app/api/recent-activity/route.ts',
  'app/api/revenue-by-segment/route.ts',
  'app/api/clients-by-campaign/route.ts',
  'app/api/revenue-by-campaign/route.ts',
  'app/api/campaign-revenue/route.ts',
  'app/api/costs/route.ts',
  'app/api/active-segments/route.ts',
  'app/api/active-campaigns/route.ts',
  'app/api/active-experiments/route.ts',
  'app/api/clients-by-segment/route.ts',
  'app/api/visitor-cohorts/route.ts',
  'app/api/leads-cohorts/route.ts',
  'app/api/ltv/route.ts',
  'app/api/traffic/session-events/route.ts',
  'app/api/traffic/session-events-referrers/route.ts',
  'app/api/traffic/referrals/route.ts',
  'app/api/traffic/client-conversion/route.ts',
  'app/api/traffic/lead-conversion/route.ts',
  'app/api/traffic/session-time/route.ts',
  'app/api/traffic/browsers/route.ts',
  'app/api/traffic/devices/route.ts',
  'app/api/traffic/pages/route.ts',
  'app/api/traffic/regions/route.ts',
  'app/api/segment-metrics/route.ts',
  'app/api/segments/metrics/route.ts',
  'app/api/traffic/visits/route.ts',
  'app/api/traffic/session-events-combined/route.ts',
  'app/api/cohorts/route.ts'
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`Skipping ${file} - does not exist`);
    continue;
  }
  
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  let newLines = [];
  
  let inBlock = false;
  let braceCount = 0;
  
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    
    // Check if line is the start of the block
    if (!inBlock && (line.includes('if (siteId.startsWith("demo-")) {') || line.includes("if (siteId.startsWith('demo-')) {"))) {
      inBlock = true;
      braceCount = 1;
      
      // Look back to remove comments if present
      if (newLines.length > 0 && newLines[newLines.length - 1].includes('// Handle demo sites')) {
        newLines.pop();
      }
      i++;
      continue;
    }
    
    if (inBlock) {
      // Count braces
      let openBraces = (line.match(/\{/g) || []).length;
      let closeBraces = (line.match(/\}/g) || []).length;
      
      braceCount += openBraces;
      braceCount -= closeBraces;
      
      if (braceCount <= 0) {
        inBlock = false;
      }
      i++;
      continue;
    }
    
    newLines.push(line);
    i++;
  }
  
  const newContent = newLines.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(file, newContent);
    console.log(`Updated ${file}`);
  } else {
    console.log(`No changes made to ${file}`);
  }
}
