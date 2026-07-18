const fs = require('fs');
let content = fs.readFileSync('app/context/LocalizationContext.tsx', 'utf8');

const en = `
    'layout.nav.pos.title': 'Point of Sale',
    'layout.nav.pos.help': 'Day-1 staff POS to sell catalog items',
    'layout.nav.catalog.title': 'Catalog',
    'layout.nav.catalog.help': 'Manage products and services',
    'layout.nav.priceLists.title': 'Price Lists',
    'layout.nav.priceLists.help': 'Manage pricing tiers',
    'layout.nav.inventory.title': 'Inventory',
    'layout.nav.inventory.help': 'Manage stock levels and locations',
    'layout.nav.shipments.title': 'Shipments',
    'layout.nav.shipments.help': 'Fulfill orders and track logistics',
    'layout.nav.promotions.title': 'Promotions',
    'layout.nav.promotions.help': 'Discounts linked to campaigns',
`;

const es = `
    'layout.nav.pos.title': 'Punto de Venta',
    'layout.nav.pos.help': 'POS para ventas de catálogo en tienda',
    'layout.nav.catalog.title': 'Catálogo',
    'layout.nav.catalog.help': 'Gestiona productos y servicios',
    'layout.nav.priceLists.title': 'Listas de Precios',
    'layout.nav.priceLists.help': 'Gestiona niveles de precios',
    'layout.nav.inventory.title': 'Inventario',
    'layout.nav.inventory.help': 'Gestiona stock y ubicaciones',
    'layout.nav.shipments.title': 'Envíos',
    'layout.nav.shipments.help': 'Despacha órdenes y sigue logística',
    'layout.nav.promotions.title': 'Promociones',
    'layout.nav.promotions.help': 'Descuentos vinculados a campañas',
`;

content = content.replace("'layout.nav.sales.title': 'Sales',", en + "\n    'layout.nav.sales.title': 'Sales',");
content = content.replace("'layout.nav.sales.title': 'Ventas',", es + "\n    'layout.nav.sales.title': 'Ventas',");

fs.writeFileSync('app/context/LocalizationContext.tsx', content);
