const fs = require('fs');
let content = fs.readFileSync('app/components/settings/MarketingSection.tsx', 'utf8');

const productsSectionRegex = /<Card className="border shadow-sm">[\s\S]*?<CardTitle className="text-xl font-semibold">Products<\/CardTitle>[\s\S]*?<\/Card>/;
const servicesSectionRegex = /<Card className="border shadow-sm mt-8">[\s\S]*?<CardTitle className="text-xl font-semibold">Services<\/CardTitle>[\s\S]*?<\/Card>/;

const newProductsSection = `
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/20 px-8 py-6">
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

content = content.replace(productsSectionRegex, newProductsSection);
content = content.replace(servicesSectionRegex, '');

fs.writeFileSync('app/components/settings/MarketingSection.tsx', content);
