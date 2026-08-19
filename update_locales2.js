const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'app/context/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const newTranslations = {
  'records.title': {
    'en.json': 'Records',
    'es.json': 'Registros',
    'fr.json': 'Enregistrements',
    'de.json': 'Datensätze',
    'ja.json': 'レコード'
  },
  'records.search': {
    'en.json': 'Search records...',
    'es.json': 'Buscar registros...',
    'fr.json': 'Rechercher des enregistrements...',
    'de.json': 'Datensätze suchen...',
    'ja.json': 'レコードを検索...'
  },
  'records.empty.title': {
    'en.json': 'No records found',
    'es.json': 'No se encontraron registros',
    'fr.json': 'Aucun enregistrement trouvé',
    'de.json': 'Keine Datensätze gefunden',
    'ja.json': 'レコードが見つかりません'
  },
  'records.empty.desc': {
    'en.json': 'Create a new record or adjust your filters.',
    'es.json': 'Cree un nuevo registro o ajuste sus filtros.',
    'fr.json': 'Créez un nouvel enregistrement ou ajustez vos filtres.',
    'de.json': 'Erstellen Sie einen neuen Datensatz oder passen Sie Ihre Filter an.',
    'ja.json': '新しいレコードを作成するか、フィルターを調整してください。'
  },
  'records.sidebar.allRecords': {
    'en.json': 'All Records',
    'es.json': 'Todos los registros',
    'fr.json': 'Tous les enregistrements',
    'de.json': 'Alle Datensätze',
    'ja.json': 'すべてのレコード'
  },
  'records.sidebar.newCategory': {
    'en.json': 'New Category',
    'es.json': 'Nueva categoría',
    'fr.json': 'Nouvelle catégorie',
    'de.json': 'Neue Kategorie',
    'ja.json': '新しいカテゴリー'
  },
  'records.sidebar.unnamed': {
    'en.json': 'Unnamed',
    'es.json': 'Sin nombre',
    'fr.json': 'Sans nom',
    'de.json': 'Ohne Namen',
    'ja.json': '無名'
  },
  'records.uncategorized': {
    'en.json': 'Uncategorized',
    'es.json': 'Sin categoría',
    'fr.json': 'Non catégorisé',
    'de.json': 'Nicht kategorisiert',
    'ja.json': '未分類'
  },
  'records.unknown': {
    'en.json': 'Unknown',
    'es.json': 'Desconocido',
    'fr.json': 'Inconnu',
    'de.json': 'Unbekannt',
    'ja.json': '不明'
  },
  'records.unknownDate': {
    'en.json': 'Unknown Date',
    'es.json': 'Fecha desconocida',
    'fr.json': 'Date inconnue',
    'de.json': 'Unbekanntes Datum',
    'ja.json': '不明な日付'
  },
  'records.groupBy': {
    'en.json': 'Group by...',
    'es.json': 'Agrupar por...',
    'fr.json': 'Grouper par...',
    'de.json': 'Gruppieren nach...',
    'ja.json': 'グループ化...'
  },
  'records.groupBy.status': {
    'en.json': 'Status',
    'es.json': 'Estado',
    'fr.json': 'Statut',
    'de.json': 'Status',
    'ja.json': 'ステータス'
  },
  'records.groupBy.category': {
    'en.json': 'Category',
    'es.json': 'Categoría',
    'fr.json': 'Catégorie',
    'de.json': 'Kategorie',
    'ja.json': 'カテゴリー'
  },
  'records.groupBy.date': {
    'en.json': 'Date (Month)',
    'es.json': 'Fecha (Mes)',
    'fr.json': 'Date (Mois)',
    'de.json': 'Datum (Monat)',
    'ja.json': '日付（月）'
  },
  'records.kanban.noRecords': {
    'en.json': 'No records found',
    'es.json': 'No se encontraron registros',
    'fr.json': 'Aucun enregistrement trouvé',
    'de.json': 'Keine Datensätze gefunden',
    'ja.json': 'レコードが見つかりません'
  },
  'records.table.noRecords': {
    'en.json': 'No records found.',
    'es.json': 'No se encontraron registros.',
    'fr.json': 'Aucun enregistrement trouvé.',
    'de.json': 'Keine Datensätze gefunden.',
    'ja.json': 'レコードが見つかりません。'
  },
  'records.table.title': {
    'en.json': 'Title',
    'es.json': 'Título',
    'fr.json': 'Titre',
    'de.json': 'Titel',
    'ja.json': 'タイトル'
  },
  'records.table.category': {
    'en.json': 'Category',
    'es.json': 'Categoría',
    'fr.json': 'Catégorie',
    'de.json': 'Kategorie',
    'ja.json': 'カテゴリー'
  },
  'records.table.status': {
    'en.json': 'Status',
    'es.json': 'Estado',
    'fr.json': 'Statut',
    'de.json': 'Status',
    'ja.json': 'ステータス'
  },
  'records.table.createdAt': {
    'en.json': 'Created At',
    'es.json': 'Creado el',
    'fr.json': 'Créé le',
    'de.json': 'Erstellt am',
    'ja.json': '作成日'
  },
  'records.sort.by': {
    'en.json': 'Sort by',
    'es.json': 'Ordenar por',
    'fr.json': 'Trier par',
    'de.json': 'Sortieren nach',
    'ja.json': '並べ替え'
  },
  'records.sort.newest': {
    'en.json': 'Newest',
    'es.json': 'Más nuevos',
    'fr.json': 'Plus récents',
    'de.json': 'Neueste',
    'ja.json': '最新'
  },
  'records.sort.oldest': {
    'en.json': 'Oldest',
    'es.json': 'Más antiguos',
    'fr.json': 'Plus anciens',
    'de.json': 'Älteste',
    'ja.json': '古い順'
  },
  'records.sort.titleAsc': {
    'en.json': 'Title (A-Z)',
    'es.json': 'Título (A-Z)',
    'fr.json': 'Titre (A-Z)',
    'de.json': 'Titel (A-Z)',
    'ja.json': 'タイトル (A-Z)'
  },
  'records.sort.titleDesc': {
    'en.json': 'Title (Z-A)',
    'es.json': 'Título (Z-A)',
    'fr.json': 'Titre (Z-A)',
    'de.json': 'Titel (Z-A)',
    'ja.json': 'タイトル (Z-A)'
  },
  'records.toast.templateUpdated': {
    'en.json': 'Template updated',
    'es.json': 'Plantilla actualizada',
    'fr.json': 'Modèle mis à jour',
    'de.json': 'Vorlage aktualisiert',
    'ja.json': 'テンプレートを更新しました'
  },
  'records.toast.templateCreated': {
    'en.json': 'Template created',
    'es.json': 'Plantilla creada',
    'fr.json': 'Modèle créé',
    'de.json': 'Vorlage erstellt',
    'ja.json': 'テンプレートを作成しました'
  },
  'records.toast.selectCategory': {
    'en.json': 'Please select or create a category first',
    'es.json': 'Por favor, seleccione o cree una categoría primero',
    'fr.json': 'Veuillez d\'abord sélectionner ou créer une catégorie',
    'de.json': 'Bitte wählen oder erstellen Sie zuerst eine Kategorie',
    'ja.json': 'まずカテゴリーを選択するか作成してください'
  },
  'records.untitled': {
    'en.json': 'Untitled Record',
    'es.json': 'Registro sin título',
    'fr.json': 'Enregistrement sans titre',
    'de.json': 'Unbenannter Datensatz',
    'ja.json': '無題のレコード'
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
