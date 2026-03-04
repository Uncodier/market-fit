const fs = require('fs');

const file = 'app/components/auth/sections/MockupSlider.tsx';
let content = fs.readFileSync(file, 'utf8');

// I see some bg-slate-50 or bg-[#121214] that should be white or light specific.
content = content.replace(/dark:bg-\[#121214\] bg-slate-50/g, 'dark:bg-[#121214] bg-[#ffffff]');

fs.writeFileSync(file, content, 'utf8');

const claw = 'app/components/auth/sections/OpenClawCard.tsx';
let clawContent = fs.readFileSync(claw, 'utf8');
clawContent = clawContent.replace(/dark:bg-\[#121214\] bg-slate-50/g, 'dark:bg-[#121214] bg-[#ffffff]');
fs.writeFileSync(claw, clawContent, 'utf8');

const feat = 'app/components/auth/sections/FeaturesStages.tsx';
let featContent = fs.readFileSync(feat, 'utf8');
featContent = featContent.replace(/dark:bg-\[#09090b\] bg-slate-100\/90/g, 'dark:bg-[#09090b] bg-white/90');
// Just looking for neu-base, neu-mockup-screen inside FeaturesStages
featContent = featContent.replace(/neu-mockup-screen-light/g, 'neu-mockup-screen-light');
fs.writeFileSync(feat, featContent, 'utf8');

