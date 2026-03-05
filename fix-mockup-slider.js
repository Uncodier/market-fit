const fs = require('fs');

const file = 'app/components/auth/sections/MockupSlider.tsx';
let content = fs.readFileSync(file, 'utf8');
let lines = content.split('\n');

const patterns = [
  // CrmMockup
  [
    `        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.05),transparent_50%)] transition-colors pointer-events-none"></div>`,
    `        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.1)_8px,rgba(139,92,246,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.05)_8px,rgba(139,92,246,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>`
  ],
  // ControlCenterMockup
  [
    `        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.05),transparent_50%)] transition-colors pointer-events-none"></div>`,
    `        <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(6,182,212,0.1)_10px,rgba(6,182,212,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>`
  ],
  // DashboardMockup
  [
    `        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.05),transparent_50%)] transition-colors pointer-events-none"></div>`,
    `        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.3)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-[0.03] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] pointer-events-none animate-pan-diagonal-fast"></div>`
  ],
  // ChatMockup
  [
    `        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.05),transparent_50%)] transition-colors pointer-events-none"></div>`,
    `        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(236,72,153,0.1)_8px,rgba(236,72,153,0.1)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>`
  ],
  // AgentsMockup
  [
    `        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.05),transparent_50%)] transition-colors pointer-events-none"></div>`,
    `        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(244,63,94,0.1)_8px,rgba(244,63,94,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(244,63,94,0.05)_8px,rgba(244,63,94,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>`
  ],
  // GoalsMockup
  [
    `        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.05),transparent_50%)] transition-colors pointer-events-none"></div>`,
    `        <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(234,179,8,0.1)_10px,rgba(234,179,8,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>`
  ]
];

let patternIndex = 0;
let modified = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('className="absolute inset-0 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none z-50"></div>')) {
    if (patternIndex < patterns.length) {
      // Avoid inserting if it looks like we already inserted
      if (!lines[i+1] || !lines[i+1].includes('transition-colors pointer-events-none"></div>')) {
        lines.splice(i + 1, 0, patterns[patternIndex][0], patterns[patternIndex][1]);
        i += 2;
        modified = true;
      }
      patternIndex++;
    }
  }
}

if (modified) {
  fs.writeFileSync(file, lines.join('\n'));
  console.log("Mockups backgrounds updated successfully.");
} else {
  console.log("No modifications made (perhaps already applied or patterns exhausted).");
}
