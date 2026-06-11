const fs = require('fs');
const glob = require('glob');

const paths = [
  'app/content/[id]/page.tsx',
  'app/teleprompter/[id]/page.tsx',
  'app/components/navigation/ConfigurationSection.tsx',
  'app/components/simple-messages-view/components/MessageInput.tsx',
  'app/components/common/SafariSettingsLink.tsx',
  'app/components/navigation/NavigationAreaGroups.tsx',
  'app/components/navigation/MenuItem.tsx',
  'app/components/ui/build-with-ai-button.tsx'
];

paths.forEach(p => {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    
    // Replace <div with <span for elements containing safari-icon-fix
    let newContent = content.replace(/<div([^>]*safari-icon-fix[^>]*)>/g, '<span$1>');
    
    if (newContent !== content) {
      // Need to replace the corresponding </div> with </span>
      // But it's tricky to do with regex alone. Let's just use string operations manually.
      console.log('Needs updating:', p);
    }
  }
});
