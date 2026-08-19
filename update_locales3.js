const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'app/context/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const newTranslations = {
  'records.table.of': {
    'en.json': 'of',
    'es.json': 'de',
    'fr.json': 'de',
    'de.json': 'von',
    'ja.json': 'の'
  },
  'records.toast.reordered': {
    'en.json': 'Record reordered successfully',
    'es.json': 'Registro reordenado con éxito',
    'fr.json': 'Enregistrement réorganisé avec succès',
    'de.json': 'Datensatz erfolgreich neu geordnet',
    'ja.json': 'レコードの並べ替えに成功しました'
  },
  'records.toast.movedTo': {
    'en.json': 'Record moved to',
    'es.json': 'Registro movido a',
    'fr.json': 'Enregistrement déplacé vers',
    'de.json': 'Datensatz verschoben nach',
    'ja.json': 'レコードを移動しました'
  },
  'records.toast.updateFailed': {
    'en.json': 'Failed to update record',
    'es.json': 'Error al actualizar el registro',
    'fr.json': 'Échec de la mise à jour de l\'enregistrement',
    'de.json': 'Fehler beim Aktualisieren des Datensatzes',
    'ja.json': 'レコードの更新に失敗しました'
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
