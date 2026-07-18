const fs = require('fs');

function repl(file, search, replaceStr) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.split(search).join(replaceStr);
  fs.writeFileSync(file, c);
}

// 1. EmptyCard props
repl('app/catalog/page.tsx', 'icon={Archive}', 'icon={<Archive className="h-10 w-10 text-muted-foreground mb-4" />}');
repl('app/catalog/page.tsx', 'action={', 'actionButton={');

repl('app/price-lists/page.tsx', 'icon={Tag}', 'icon={<Tag className="h-10 w-10 text-muted-foreground mb-4" />}');
repl('app/price-lists/page.tsx', 'action={', 'actionButton={');

repl('app/promotions/page.tsx', 'icon={Ticket}', 'icon={<Ticket className="h-10 w-10 text-muted-foreground mb-4" />}');
repl('app/promotions/page.tsx', 'action={', 'actionButton={');

repl('app/shipments/page.tsx', 'icon={Send}', 'icon={<Send className="h-10 w-10 text-muted-foreground mb-4" />}');
repl('app/shipments/page.tsx', 'action={', 'actionButton={');

// 2. POS getLeads
repl('app/pos/page.tsx', "getLeads(currentSite!.id, 1, 100, undefined, undefined, 'created_at')", "getLeads(currentSite!.id)");

// 3. app/promotions/actions.ts
repl('app/promotions/actions.ts', 'p => p', '(p: any) => p');
repl('app/promotions/actions.ts', 'filter(item =>', 'filter((item: any) =>');
repl('app/promotions/actions.ts', 'reduce((sum, item)', 'reduce((sum: number, item: any)');

