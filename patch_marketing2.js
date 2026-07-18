const fs = require('fs');
const lines = fs.readFileSync('app/components/settings/MarketingSection.tsx', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('<Card id="products"'));
const endIdx = lines.findIndex(l => l.includes('<Card id="competitors"'));

const replacement = `
      <Card id="catalog-redirect" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl font-semibold">Products & Services</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Products and services have moved to the new dedicated Catalog module.
              </p>
            </div>
            <a href="/catalog?artifact=true">
              <Button
                variant="outline"
                size="sm"
                type="button"
              >
                <AppWindow className="mr-2 h-4 w-4" />
                Go to Catalog
              </Button>
            </a>
          </div>
        </CardHeader>
      </Card>
`;

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx, replacement);
  fs.writeFileSync('app/components/settings/MarketingSection.tsx', lines.join('\n'));
}
