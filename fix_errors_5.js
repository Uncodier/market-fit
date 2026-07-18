const fs = require('fs');

function repl(file, search, replaceStr) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.split(search).join(replaceStr);
  fs.writeFileSync(file, c);
}

repl('app/actions/site.actions.ts', 'export const createSiteAction = action(', 'export const createSiteAction = action.schema(');
repl('app/actions/site.actions.ts', 'export const updateSiteAction = action(', 'export const updateSiteAction = action.schema(');
repl('app/actions/site.actions.ts', 'export const deleteSiteAction = action(', 'export const deleteSiteAction = action.schema(');
