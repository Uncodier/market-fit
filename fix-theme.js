const fs = require('fs');
const glob = require('glob');

const files = glob.sync('app/components/auth/**/*.{ts,tsx}');
files.push('app/auth/page.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // bg-[#030303] -> dark:bg-[#030303] bg-white
  content = content.replace(/bg-\[#030303\]/g, 'dark:bg-[#030303] bg-white');
  
  // bg-black-paper -> dark:bg-black-paper bg-white-paper
  content = content.replace(/\bbg-black-paper\b/g, 'dark:bg-black-paper bg-white-paper');
  
  // neu-black-chip -> dark:neu-black-chip neu-white-chip
  content = content.replace(/\bneu-black-chip\b/g, 'dark:neu-black-chip neu-white-chip');
  content = content.replace(/\bneu-black-chip-inward\b/g, 'dark:neu-black-chip-inward neu-white-chip-inward');
  
  // neu-base, neu-panel, neu-card -> dark:neu-... neu-...-light
  content = content.replace(/\bneu-base\b/g, 'dark:neu-base neu-base-light');
  content = content.replace(/\bneu-panel\b/g, 'dark:neu-panel neu-panel-light');
  content = content.replace(/\bneu-card\b/g, 'dark:neu-card neu-card-light');
  content = content.replace(/\bneu-pressed\b/g, 'dark:neu-pressed neu-pressed-light');
  content = content.replace(/\bneu-button\b/g, 'dark:neu-button neu-button-light');
  content = content.replace(/\bneu-skeleton\b/g, 'dark:neu-skeleton neu-skeleton-light');

  // text-white -> dark:text-white text-slate-900 (except when part of text-white/XX)
  content = content.replace(/([^a-zA-Z0-9\-])text-white(\s|"|'|`|\/)/g, (match, p1, p2) => {
    if (p2 === '/') return match; // skip text-white/50
    return `${p1}dark:text-white text-slate-900${p2}`;
  });

  // border-white/[X] -> dark:border-white/[X] border-black/[X]
  content = content.replace(/border-white\/\[([0-9.]+)\]/g, 'dark:border-white/[$1] border-black/[$1]');
  content = content.replace(/border-white\/([0-9]+)/g, 'dark:border-white/$1 border-black/$1');

  // bg-white/[X] -> dark:bg-white/[X] bg-black/[X]
  content = content.replace(/bg-white\/\[([0-9.]+)\]/g, 'dark:bg-white/[$1] bg-black/[$1]');
  content = content.replace(/bg-white\/([0-9]+)/g, 'dark:bg-white/$1 bg-black/$1');

  // text-white/[X] -> dark:text-white/[X] text-slate-500
  content = content.replace(/text-white\/([0-9]+)/g, 'dark:text-white/$1 text-slate-500');
  content = content.replace(/text-white\/\[([0-9.]+)\]/g, 'dark:text-white/[$1] text-slate-500');

  // bg-[#121214] -> dark:bg-[#121214] bg-slate-50
  content = content.replace(/bg-\[#121214\]/g, 'dark:bg-[#121214] bg-slate-50');
  content = content.replace(/bg-\[#09090b\]/g, 'dark:bg-[#09090b] bg-slate-100');

  // text-white/90 -> text-slate-800
  // since we already mapped text-white/[X] to text-slate-500 we might want to manually fix a few

  fs.writeFileSync(file, content, 'utf8');
}
console.log('Done');
