const fs = require('fs');

function repl(file, search, replaceStr) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.split(search).join(replaceStr);
  fs.writeFileSync(file, c);
}

repl('app/promotions/page.tsx', 'icon={Tag}', 'icon={<Tag className="h-10 w-10 text-muted-foreground mb-4" />}');
