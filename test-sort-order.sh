source .env.local
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/catalog_items?select=id,name,sort_order,category:catalog_categories(name,sort_order)&limit=10" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" > test-sort-order.json
node -e "const data = require('./test-sort-order.json'); console.log(data.map(d => ({ name: d.name, sort: d.sort_order, cat_sort: d.category?.sort_order, cat_name: d.category?.name })));"
