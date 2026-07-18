const fs = require('fs');
let content = fs.readFileSync('lib/types/database.types.ts', 'utf8');

// Add promotion_id and price_list_id to sale_orders Row
content = content.replace(
  '        Row: {\n          id: string\n          sale_id: string',
  '        Row: {\n          id: string\n          sale_id: string\n          promotion_id?: string | null\n          price_list_id?: string | null'
);

// Add default_price_list_id to leads Row
content = content.replace(
  '        Row: {\n          id: string\n          site_id: string\n          created_at: string\n          updated_at: string\n          name: string',
  '        Row: {\n          id: string\n          site_id: string\n          created_at: string\n          updated_at: string\n          name: string\n          default_price_list_id?: string | null'
);

// Add commerce to settings Row
content = content.replace(
  '          products: Json | null\n          services: Json | null\n          business_hours: Json | null',
  '          products: Json | null\n          services: Json | null\n          commerce: Json | null\n          business_hours: Json | null'
);

fs.writeFileSync('lib/types/database.types.ts', content);
