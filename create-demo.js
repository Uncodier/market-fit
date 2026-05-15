const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'lib', 'demo-data', 'demo-saas-en-123.ts');
const destPath = path.join(__dirname, 'lib', 'demo-data', 'demo-habituall.ts');

let data = fs.readFileSync(srcPath, 'utf8');

// Replacements to make it HabitUall
data = data.replace(/saas_en_123_data/g, 'habituall_data');
data = data.replace(/demo-saas-en-123/g, 'demo-habituall');
data = data.replace(/SaaS B2B/g, 'HabitUall');
data = data.replace(/demo-saas/g, 'demo-habituall');
data = data.replace(/saas/g, 'habituall');

// Replace commands
data = data.replace(/task: 'Process new enterprise lead'/g, "task: 'Deploy HabitUall booking system'");
data = data.replace(/task: 'Scrape competitor pricing \(HubSpot & Salesforce\)'/g, "task: 'Create UI for Yoga Classes and Private Rooms'");

// Add preview_url to the first requirement_status
// Look for completion_percentage: 100
data = data.replace(
  /completion_percentage: 100/g,
  "completion_percentage: 100,\n      preview_url: 'https://apps-o8a3yagp1.preview.makinari.com'"
);

// We should also replace some logs so it looks like the agent is working on HabitUall
data = data.replace(/Webhook received new lead data from Webinar: AI in Analytics/g, "Initializing Next.js project for HabitUall workspace booking");
data = data.replace(/Calling clearbit to enrich company data for DataTech/g, "Generating UI components for Coworking, Studio and Club sections");
data = data.replace(/Found 5 pricing tiers for Hubspot/g, "Successfully integrated Manuel Doblado 477 maps location and opening hours");

fs.writeFileSync(destPath, data);
console.log("Created demo-habituall.ts");
