const fs = require('fs');

function repl(file, search, replaceStr) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.split(search).join(replaceStr);
  fs.writeFileSync(file, c);
}

// 1. CatalogTable
repl('app/catalog/components/CatalogTable.tsx', 'Package, Box, Edit2', 'Archive, DatabaseIcon, Edit');
repl('app/catalog/components/CatalogTable.tsx', '<Package ', '<Archive ');
repl('app/catalog/components/CatalogTable.tsx', '<Box ', '<DatabaseIcon ');
repl('app/catalog/components/CatalogTable.tsx', '<Edit2 ', '<Edit ');

// 2. Catalog Page
repl('app/catalog/page.tsx', 'Package, Box', 'Archive, DatabaseIcon');
repl('app/catalog/page.tsx', '<Package ', '<Archive ');
repl('app/catalog/page.tsx', '<Box ', '<DatabaseIcon ');
repl('app/catalog/page.tsx', 'icon={Package}', 'icon={Archive}');

// 3. Inventory Page
repl('app/inventory/page.tsx', 'Box,', 'DatabaseIcon,');
repl('app/inventory/page.tsx', 'Edit2', 'Edit');
repl('app/inventory/page.tsx', '<Box ', '<DatabaseIcon ');
repl('app/inventory/page.tsx', '<Edit2 ', '<Edit ');

// 4. POS Page
repl('app/pos/page.tsx', "import { useAuth } from \"@/app/context/AuthContext\"", "import { useAuthContext as useAuth } from \"@/app/components/auth/auth-provider\"");
repl('app/pos/page.tsx', 'Package, ShoppingCart, Search, X, Plus, Minus, CreditCard, Box', 'Archive, Store, Search, X, Plus, ChevronDown, CreditCard, DatabaseIcon');
repl('app/pos/page.tsx', '<Package ', '<Archive ');
repl('app/pos/page.tsx', '<Box ', '<DatabaseIcon ');
repl('app/pos/page.tsx', '<ShoppingCart ', '<Store ');
repl('app/pos/page.tsx', '<Minus ', '<ChevronDown ');
let posC = fs.readFileSync('app/pos/page.tsx', 'utf8');
if (!posC.includes('import { Input }')) {
  posC = posC.replace('import { Badge } from "@/app/components/ui/badge"', 'import { Badge } from "@/app/components/ui/badge"\nimport { Input } from "@/app/components/ui/input"');
  fs.writeFileSync('app/pos/page.tsx', posC);
}

// 5. Price lists page
repl('app/price-lists/page.tsx', 'Edit2', 'Edit');
repl('app/price-lists/page.tsx', '<Edit2 ', '<Edit ');

// 6. Price lists id page
let pliC = fs.readFileSync('app/price-lists/[id]/page.tsx', 'utf8');
if (!pliC.includes('import { Label }')) {
  pliC = pliC.replace('import { Input } from "@/app/components/ui/input"', 'import { Input } from "@/app/components/ui/input"\nimport { Label } from "@/app/components/ui/label"');
  fs.writeFileSync('app/price-lists/[id]/page.tsx', pliC);
}

// 7. Promotions action
repl('app/promotions/actions.ts', '(sum, item)', '(sum: number, item: any)');

// 8. Promotions components
repl('app/promotions/components/CreatePromotionDialog.tsx', "import { useAuth } from \"@/app/context/AuthContext\"", "import { useAuthContext as useAuth } from \"@/app/components/auth/auth-provider\"");
repl('app/promotions/components/CreatePromotionDialog.tsx', 'campaigns?.map(', 'campaigns?.data?.map(');

// 9. Promotions page
repl('app/promotions/page.tsx', 'Edit2', 'Edit');
repl('app/promotions/page.tsx', '<Edit2 ', '<Edit ');
repl('app/promotions/[id]/page.tsx', 'i => i', '(i: any) => i');

// 10. Shipments page
repl('app/shipments/page.tsx', 'Truck', 'Send');
repl('app/shipments/page.tsx', '<Truck ', '<Send ');
repl('app/shipments/page.tsx', 'icon={Truck}', 'icon={Send}');

repl('app/shipments/[id]/page.tsx', 'Truck,', 'Send,');
repl('app/shipments/[id]/page.tsx', 'Package,', 'Archive,');
repl('app/shipments/[id]/page.tsx', '<Truck ', '<Send ');
repl('app/shipments/[id]/page.tsx', '<Package ', '<Archive ');

// 11. Shop page
repl('app/shop/[siteSlug]/ShopClient.tsx', 'ShoppingCart, Package, Box, Minus, Plus, CreditCard', 'Store, Archive, DatabaseIcon, ChevronDown, Plus, CreditCard');
repl('app/shop/[siteSlug]/ShopClient.tsx', '<ShoppingCart ', '<Store ');
repl('app/shop/[siteSlug]/ShopClient.tsx', '<Package ', '<Archive ');
repl('app/shop/[siteSlug]/ShopClient.tsx', '<Box ', '<DatabaseIcon ');
repl('app/shop/[siteSlug]/ShopClient.tsx', '<Minus ', '<ChevronDown ');

// Nav icons
repl('app/navigation/page.tsx', 'ShoppingCart, Package, Box, Tag, Truck, Gift', 'Store, Archive, DatabaseIcon, Tag, Send, Ticket');
repl('app/navigation/page.tsx', 'pos: ShoppingCart', 'pos: Store');
repl('app/navigation/page.tsx', 'catalog: Package', 'catalog: Archive');
repl('app/navigation/page.tsx', 'inventory: Box', 'inventory: DatabaseIcon');
repl('app/navigation/page.tsx', 'shipments: Truck', 'shipments: Send');
repl('app/navigation/page.tsx', 'promotions: Gift', 'promotions: Ticket');

repl('app/components/navigation/NavigationAreaGroups.tsx', 'ShoppingCart, Package, Box, Tag, Truck, Gift', 'Store, Archive, DatabaseIcon, Tag, Send, Ticket');
repl('app/components/navigation/NavigationAreaGroups.tsx', 'pos: ShoppingCart', 'pos: Store');
repl('app/components/navigation/NavigationAreaGroups.tsx', 'catalog: Package', 'catalog: Archive');
repl('app/components/navigation/NavigationAreaGroups.tsx', 'inventory: Box', 'inventory: DatabaseIcon');
repl('app/components/navigation/NavigationAreaGroups.tsx', 'shipments: Truck', 'shipments: Send');
repl('app/components/navigation/NavigationAreaGroups.tsx', 'promotions: Gift', 'promotions: Ticket');

// catalog actions
repl('app/catalog/actions.ts', '(sum, level)', '(sum: number, level: any)');

