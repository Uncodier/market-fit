const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'app/context/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const translations = {
  'en.json': 'Records',
  'es.json': 'Registros',
  'de.json': 'Datensätze',
  'fr.json': 'Enregistrements',
  'ja.json': 'レコード'
};

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!data['layout.sidebar.records']) {
    data['layout.sidebar.records'] = translations[file] || 'Records';
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${file}`);
  }
});
