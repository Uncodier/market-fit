const fs = require('fs');
const path = './__tests__/commerce/pass-round-robin.test.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace('existing.available = Math.max(existing.available, slot.available)', 'existing.available += slot.available');
code = code.replace(/unions start\/end and uses max availability for a single assignee/g, 'unions start/end and sums availability');
code = code.replace(/expect\(merged\[0\]\.available\)\.toBe\(5\)/g, 'expect(merged[0].available).toBe(7)');
fs.writeFileSync(path, code);
