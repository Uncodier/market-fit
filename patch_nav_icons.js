const fs = require('fs');

const iconImports = `
import { ShoppingCart, Package, Box, Tag, Truck, Gift } from "@/app/components/ui/icons"
`;
const iconMap = `
    pos: ShoppingCart,
    catalog: Package,
    priceLists: Tag,
    inventory: Box,
    shipments: Truck,
    promotions: Gift,
`;

const files = ['app/navigation/page.tsx', 'app/components/navigation/NavigationAreaGroups.tsx'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('ShoppingCart')) {
    content = content.replace('import {', 'import { ShoppingCart, Package, Box, Tag, Truck, Gift, ');
  }
  
  content = content.replace('salesHome: Home,', 'salesHome: Home,' + iconMap);
  fs.writeFileSync(file, content);
}
