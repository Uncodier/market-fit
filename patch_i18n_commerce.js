const fs = require('fs');

const path = './app/context/LocalizationContext.tsx';
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const enCommerce = [
  "    // Commerce Modules",
  "    'status.active': 'Active',",
  "    'status.archived': 'Archived',",
  "    'catalog.name': 'Name & SKU',",
  "    'catalog.price': 'Target Price',",
  "    'catalog.mode': 'Availability Mode',",
  "    'catalog.status': 'Sellable Status',",
  "    'catalog.kind.all': 'All Items',",
  "    'catalog.kind.product': 'Products',",
  "    'catalog.kind.service': 'Services',",
  "    'catalog.search': 'Search catalog...',",
  "    'catalog.empty.title': 'No items found',",
  "    'catalog.empty.description': 'Start by adding products or services to your catalog.',",
  "    'catalog.addItem': 'Add Item',",
  "    'priceLists.name': 'Name',",
  "    'priceLists.code': 'Code',",
  "    'priceLists.currency': 'Currency',",
  "    'priceLists.status': 'Status',",
  "    'priceLists.empty.title': 'No price lists',",
  "    'priceLists.empty.description': 'Create a price list to manage different pricing tiers.',",
  "    'priceLists.addList': 'Create List',",
  "    'shipments.search': 'Search tracking or customer...',",
  "    'shipments.empty.title': 'No shipments found',",
  "    'shipments.empty.description': 'Shipments will appear here once an order is created with shipping.',",
  "    'promotions.search': 'Search name or code...',",
  "    'promotions.empty.title': 'No promotions found',",
  "    'promotions.empty.description': 'Create a discount code or automatic promotion.',",
  "    'promotions.add': 'Create Promotion',",
  "    'pos.checkout': 'Checkout',",
];

const esCommerce = [
  "    // Commerce Modules",
  "    'status.active': 'Activo',",
  "    'status.archived': 'Archivado',",
  "    'catalog.name': 'Nombre y SKU',",
  "    'catalog.price': 'Precio Objetivo',",
  "    'catalog.mode': 'Modo de Disponibilidad',",
  "    'catalog.status': 'Estado de Venta',",
  "    'catalog.kind.all': 'Todos los Artículos',",
  "    'catalog.kind.product': 'Productos',",
  "    'catalog.kind.service': 'Servicios',",
  "    'catalog.search': 'Buscar en el catálogo...',",
  "    'catalog.empty.title': 'No se encontraron artículos',",
  "    'catalog.empty.description': 'Comienza agregando productos o servicios a tu catálogo.',",
  "    'catalog.addItem': 'Añadir Artículo',",
  "    'priceLists.name': 'Nombre',",
  "    'priceLists.code': 'Código',",
  "    'priceLists.currency': 'Moneda',",
  "    'priceLists.status': 'Estado',",
  "    'priceLists.empty.title': 'No hay listas de precios',",
  "    'priceLists.empty.description': 'Crea una lista de precios para gestionar diferentes niveles de precios.',",
  "    'priceLists.addList': 'Crear Lista',",
  "    'shipments.search': 'Buscar rastreo o cliente...',",
  "    'shipments.empty.title': 'No se encontraron envíos',",
  "    'shipments.empty.description': 'Los envíos aparecerán aquí una vez que se cree un pedido con envío.',",
  "    'promotions.search': 'Buscar nombre o código...',",
  "    'promotions.empty.title': 'No se encontraron promociones',",
  "    'promotions.empty.description': 'Crea un código de descuento o una promoción automática.',",
  "    'promotions.add': 'Crear Promoción',",
  "    'pos.checkout': 'Pagar',",
];

const frCommerce = [
  "    // Commerce Modules",
  "    'status.active': 'Actif',",
  "    'status.archived': 'Archivé',",
  "    'catalog.name': 'Nom et SKU',",
  "    'catalog.price': 'Prix Cible',",
  "    'catalog.mode': 'Mode de Disponibilité',",
  "    'catalog.status': 'Statut de Vente',",
  "    'catalog.kind.all': 'Tous les articles',",
  "    'catalog.kind.product': 'Produits',",
  "    'catalog.kind.service': 'Services',",
  "    'catalog.search': 'Rechercher dans le catalogue...',",
  "    'catalog.empty.title': 'Aucun article trouvé',",
  "    'catalog.empty.description': 'Commencez par ajouter des produits ou des services à votre catalogue.',",
  "    'catalog.addItem': 'Ajouter un article',",
  "    'priceLists.name': 'Nom',",
  "    'priceLists.code': 'Code',",
  "    'priceLists.currency': 'Devise',",
  "    'priceLists.status': 'Statut',",
  "    'priceLists.empty.title': 'Aucune liste de prix',",
  "    'priceLists.empty.description': 'Créez une liste de prix pour gérer différents niveaux de tarification.',",
  "    'priceLists.addList': 'Créer une liste',",
  "    'shipments.search': 'Rechercher un suivi ou un client...',",
  "    'shipments.empty.title': 'Aucun envoi trouvé',",
  "    'shipments.empty.description': 'Les envois apparaîtront ici une fois qu\\'une commande avec expédition aura été créée.',",
  "    'promotions.search': 'Rechercher un nom ou un code...',",
  "    'promotions.empty.title': 'Aucune promotion trouvée',",
  "    'promotions.empty.description': 'Créez un code de réduction ou une promotion automatique.',",
  "    'promotions.add': 'Créer une promotion',",
  "    'pos.checkout': 'Payer',",
];

const deCommerce = [
  "    // Commerce Modules",
  "    'status.active': 'Aktiv',",
  "    'status.archived': 'Archiviert',",
  "    'catalog.name': 'Name & SKU',",
  "    'catalog.price': 'Zielpreis',",
  "    'catalog.mode': 'Verfügbarkeitsmodus',",
  "    'catalog.status': 'Verkaufsstatus',",
  "    'catalog.kind.all': 'Alle Artikel',",
  "    'catalog.kind.product': 'Produkte',",
  "    'catalog.kind.service': 'Dienstleistungen',",
  "    'catalog.search': 'Katalog durchsuchen...',",
  "    'catalog.empty.title': 'Keine Artikel gefunden',",
  "    'catalog.empty.description': 'Beginnen Sie damit, Produkte oder Dienstleistungen zu Ihrem Katalog hinzuzufügen.',",
  "    'catalog.addItem': 'Artikel hinzufügen',",
  "    'priceLists.name': 'Name',",
  "    'priceLists.code': 'Code',",
  "    'priceLists.currency': 'Währung',",
  "    'priceLists.status': 'Status',",
  "    'priceLists.empty.title': 'Keine Preislisten',",
  "    'priceLists.empty.description': 'Erstellen Sie eine Preisliste, um verschiedene Preisstufen zu verwalten.',",
  "    'priceLists.addList': 'Liste erstellen',",
  "    'shipments.search': 'Sendungsverfolgung oder Kunde suchen...',",
  "    'shipments.empty.title': 'Keine Sendungen gefunden',",
  "    'shipments.empty.description': 'Sendungen werden hier angezeigt, sobald eine Bestellung mit Versand erstellt wurde.',",
  "    'promotions.search': 'Name oder Code suchen...',",
  "    'promotions.empty.title': 'Keine Werbeaktionen gefunden',",
  "    'promotions.empty.description': 'Erstellen Sie einen Rabattcode oder eine automatische Werbeaktion.',",
  "    'promotions.add': 'Werbeaktion erstellen',",
  "    'pos.checkout': 'Kasse',",
];

const jaCommerce = [
  "    // Commerce Modules",
  "    'status.active': 'アクティブ',",
  "    'status.archived': 'アーカイブ済み',",
  "    'catalog.name': '名前とSKU',",
  "    'catalog.price': '目標価格',",
  "    'catalog.mode': '可用性モード',",
  "    'catalog.status': '販売ステータス',",
  "    'catalog.kind.all': 'すべてのアイテム',",
  "    'catalog.kind.product': '製品',",
  "    'catalog.kind.service': 'サービス',",
  "    'catalog.search': 'カタログを検索...',",
  "    'catalog.empty.title': 'アイテムが見つかりません',",
  "    'catalog.empty.description': 'カタログに製品やサービスを追加することから始めます。',",
  "    'catalog.addItem': 'アイテムを追加',",
  "    'priceLists.name': '名前',",
  "    'priceLists.code': 'コード',",
  "    'priceLists.currency': '通貨',",
  "    'priceLists.status': 'ステータス',",
  "    'priceLists.empty.title': '価格リストがありません',",
  "    'priceLists.empty.description': '価格リストを作成して、さまざまな価格設定層を管理します。',",
  "    'priceLists.addList': 'リストを作成',",
  "    'shipments.search': '追跡または顧客を検索...',",
  "    'shipments.empty.title': '出荷が見つかりません',",
  "    'shipments.empty.description': '出荷のある注文が作成されると、ここに出荷が表示されます。',",
  "    'promotions.search': '名前またはコードを検索...',",
  "    'promotions.empty.title': 'プロモーションが見つかりません',",
  "    'promotions.empty.description': '割引コードまたは自動プロモーションを作成します。',",
  "    'promotions.add': 'プロモーションを作成',",
  "    'pos.checkout': 'チェックアウト',",
];

let insertPoints = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '  },' || lines[i] === '  }') {
    insertPoints.push(i);
  }
}

// We expect `  },` at 2596(en), 5249(es), 5413(fr), 5545(de), 5682(ja) roughly.
// Specifically we only want to inject into the top-level locale objects.
// Let's find exactly the lines that close the locales by checking the structure.
const enEnd = lines.findIndex((l, i) => l === '  },' && lines[i+1] === '  es: {');
const esEnd = lines.findIndex((l, i) => l === '  },' && lines[i+1] === '  fr: {');
const frEnd = lines.findIndex((l, i) => l === '  },' && lines[i+1] === '  de: {');
const deEnd = lines.findIndex((l, i) => l === '  },' && lines[i+1] === '  ja: {');
const jaEnd = lines.findIndex((l, i) => l === '  },' && lines[i+1] === '};');

console.log({ enEnd, esEnd, frEnd, deEnd, jaEnd });

if (enEnd !== -1 && esEnd !== -1 && frEnd !== -1 && deEnd !== -1 && jaEnd !== -1) {
  lines.splice(jaEnd, 0, ...jaCommerce);
  lines.splice(deEnd, 0, ...deCommerce);
  lines.splice(frEnd, 0, ...frCommerce);
  lines.splice(esEnd, 0, ...esCommerce);
  lines.splice(enEnd, 0, ...enCommerce);
  
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('patched arrays safely');
} else {
  console.error('Could not find all insertion points.');
}
