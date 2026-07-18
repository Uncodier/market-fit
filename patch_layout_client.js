const fs = require('fs');
let content = fs.readFileSync('app/layout-client.tsx', 'utf8');

const navMap = `
    "/pos": "pos",
    "/catalog": "catalog",
    "/price-lists": "priceLists",
    "/inventory": "inventory",
    "/shipments": "shipments",
    "/promotions": "promotions",
`;

content = content.replace('"/control-center": "controlCenter",', '"/control-center": "controlCenter",' + navMap);
fs.writeFileSync('app/layout-client.tsx', content);
