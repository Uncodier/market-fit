const fs = require('fs');
let content = fs.readFileSync('app/config/navigation-areas.ts', 'utf8');

const newSalesItems = `
      { key: "salesHome", href: "/sales-home", hidden: true },
      { key: "pos", href: "/pos" },
      { key: "catalog", href: "/catalog" },
      { key: "priceLists", href: "/price-lists" },
      { key: "inventory", href: "/inventory" },
      { key: "shipments", href: "/shipments" },
      { key: "promotions", href: "/promotions" },
`;
content = content.replace('{ key: "salesHome", href: "/sales-home", hidden: true },', newSalesItems.trim());

fs.writeFileSync('app/config/navigation-areas.ts', content);
