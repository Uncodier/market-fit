const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'app/context/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const newTranslations = {
  'settings.team.appAccess': {
    'en.json': 'App access',
    'es.json': 'Acceso a la aplicación',
    'fr.json': 'Accès à l\'application',
    'de.json': 'App-Zugriff',
    'ja.json': 'アプリへのアクセス'
  },
  'settings.team.hidden': {
    'en.json': 'hidden',
    'es.json': 'oculto',
    'fr.json': 'masqué',
    'de.json': 'versteckt',
    'ja.json': '非表示'
  },
  'settings.team.allAppsVisible': {
    'en.json': 'All apps visible',
    'es.json': 'Todas las apps visibles',
    'fr.json': 'Toutes les apps visibles',
    'de.json': 'Alle Apps sichtbar',
    'ja.json': 'すべてのアプリが表示されています'
  },
  'settings.team.hiddenAppsDesc': {
    'en.json': 'Hidden apps will not appear in this member\'s menu.',
    'es.json': 'Las aplicaciones ocultas no aparecerán en el menú de este miembro.',
    'fr.json': 'Les applications masquées n\'apparaîtront pas dans le menu de ce membre.',
    'de.json': 'Ausgeblendete Apps werden nicht im Menü dieses Mitglieds angezeigt.',
    'ja.json': '非表示のアプリはこのメンバーのメニューに表示されません。'
  },
  'settings.team.showAll': {
    'en.json': 'Show all',
    'es.json': 'Mostrar todas',
    'fr.json': 'Afficher tout',
    'de.json': 'Alle anzeigen',
    'ja.json': 'すべて表示'
  },
  'settings.team.hideAll': {
    'en.json': 'Hide all',
    'es.json': 'Ocultar todas',
    'fr.json': 'Masquer tout',
    'de.json': 'Alle ausblenden',
    'ja.json': 'すべて非表示'
  },
  'settings.team.showApp': {
    'en.json': 'Show this app',
    'es.json': 'Mostrar esta app',
    'fr.json': 'Afficher cette application',
    'de.json': 'Diese App anzeigen',
    'ja.json': 'このアプリを表示'
  },
  'settings.team.hideApp': {
    'en.json': 'Hide this app',
    'es.json': 'Ocultar esta app',
    'fr.json': 'Masquer cette application',
    'de.json': 'Diese App ausblenden',
    'ja.json': 'このアプリを非表示'
  }
};

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  let updated = false;
  
  for (const [key, t] of Object.entries(newTranslations)) {
    if (data[key] !== t[file] && t[file]) {
      data[key] = t[file];
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${file}`);
  }
});
