source .env.local
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/catalog_items?select=id,name,category:catalog_categories(name,sort_order)&order=category(sort_order).asc.nullslast&limit=50" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" > test-rest-result.json
node -e "const data = require('./test-rest-result.json'); console.log(data.filter(d => !d.category).length, 'items without category'); console.log('First 5:', data.slice(0, 5).map(d => d.category?.name || 'none')); console.log('Last 5:', data.slice(-5).map(d => d.category?.name || 'none'));"
