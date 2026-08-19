const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'app/context/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const newTranslations = {
  'records.calendar.moreRecords': {
    'en.json': '+{count} more records',
    'es.json': '+{count} registros más',
    'fr.json': '+{count} autres enregistrements',
    'de.json': '+{count} weitere Datensätze',
    'ja.json': '他 {count} 件のレコード'
  },
  'records.calendar.noRecords': {
    'en.json': 'No records',
    'es.json': 'Sin registros',
    'fr.json': 'Aucun enregistrement',
    'de.json': 'Keine Datensätze',
    'ja.json': 'レコードなし'
  },
  'records.calendar.today': {
    'en.json': 'Today',
    'es.json': 'Hoy',
    'fr.json': 'Aujourd\'hui',
    'de.json': 'Heute',
    'ja.json': '今日'
  },
  'records.calendar.year': {
    'en.json': 'Year',
    'es.json': 'Año',
    'fr.json': 'Année',
    'de.json': 'Jahr',
    'ja.json': '年'
  },
  'records.calendar.month': {
    'en.json': 'Month',
    'es.json': 'Mes',
    'fr.json': 'Mois',
    'de.json': 'Monat',
    'ja.json': '月'
  },
  'records.calendar.week': {
    'en.json': 'Week',
    'es.json': 'Semana',
    'fr.json': 'Semaine',
    'de.json': 'Woche',
    'ja.json': '週'
  },
  'records.calendar.day': {
    'en.json': 'Day',
    'es.json': 'Día',
    'fr.json': 'Jour',
    'de.json': 'Tag',
    'ja.json': '日'
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
