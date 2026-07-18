const fs = require('fs');
let content = fs.readFileSync('app/context/LocalizationContext.tsx', 'utf8');

const en = `
    'layout.sidebar.pos': 'Point of Sale',
    'layout.sidebar.catalog': 'Catalog',
    'layout.sidebar.priceLists': 'Price Lists',
    'layout.sidebar.inventory': 'Inventory',
    'layout.sidebar.shipments': 'Shipments',
    'layout.sidebar.promotions': 'Promotions',
`;

const es = `
    'layout.sidebar.pos': 'Punto de Venta',
    'layout.sidebar.catalog': 'Catálogo',
    'layout.sidebar.priceLists': 'Listas de Precios',
    'layout.sidebar.inventory': 'Inventario',
    'layout.sidebar.shipments': 'Envíos',
    'layout.sidebar.promotions': 'Promociones',
`;

content = content.replace("'layout.sidebar.sales': 'Sales',", en + "\n    'layout.sidebar.sales': 'Sales',");
content = content.replace("'layout.sidebar.sales': 'Ventas',", es + "\n    'layout.sidebar.sales': 'Ventas',");

fs.writeFileSync('app/context/LocalizationContext.tsx', content);
