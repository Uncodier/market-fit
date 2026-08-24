const fs = require('fs');
const path = 'app/components/ui/icons.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldIcon = `// Workflow
export const Workflow = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </svg>
  </IconWrapper>
)`;

const newIcon = `// Workflow
export const Workflow = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="6" height="6" rx="1.5" />
      <rect x="16" y="2" width="6" height="6" rx="1.5" />
      <rect x="16" y="16" width="6" height="6" rx="1.5" />
      <path d="M8 12h3.5a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5h1.5" />
      <path d="M8 12h3.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 0 1.5 1.5h1.5" />
    </svg>
  </IconWrapper>
)`;

// Note: Using strokeWidth="1" or "1.5"? Let's use "1" to match others, 
// wait, the prompt says "mejora el icono de workflow", let's use "1" first, 
// I'll define it with 1 as standard, but maybe "1.5" if it looks too thin?
// All others in the file use strokeWidth="1"

const oldIcon1 = `// Workflow
export const Workflow = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </svg>
  </IconWrapper>
)`;

const newIcon1 = `// Workflow
export const Workflow = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="6" height="6" rx="1.5" />
      <rect x="16" y="2" width="6" height="6" rx="1.5" />
      <rect x="16" y="16" width="6" height="6" rx="1.5" />
      <path d="M8 12h3.5a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5h1.5" />
      <path d="M8 12h3.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 0 1.5 1.5h1.5" />
    </svg>
  </IconWrapper>
)`;

content = content.replace(oldIcon1, newIcon1);
fs.writeFileSync(path, content);
