const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'app/context/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const newTranslations = {
  'records.groupBy.teamMember': {
    'en.json': 'Team Member',
    'es.json': 'Miembro del equipo',
    'fr.json': 'Membre de l\'équipe',
    'de.json': 'Teammitglied',
    'ja.json': 'チームメンバー'
  }
};

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  let updated = false;
  
  for (const [key, t] of Object.entries(newTranslations)) {
    if (data[key] !== t[file]) {
      data[key] = t[file];
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${file}`);
  }
});
