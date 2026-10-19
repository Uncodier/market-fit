import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { CATALOG_IMPORT_FIELDS, type CatalogImportMapping } from "../import-schema"

interface Props {
  headers: string[]
  mapping: CatalogImportMapping
  onMappingChange: (mapping: CatalogImportMapping) => void
  defaultCurrency: string
  onCurrencyChange: (currency: string) => void
  disabled: boolean
}

export function ImportCatalogMapping({ headers, mapping, onMappingChange, defaultCurrency, onCurrencyChange, disabled }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-medium">Match your columns</h3>
        <p className="text-sm text-muted-foreground">SKU and name are required. Prices and all other fields are optional. Unmapped and blank optional fields will not overwrite existing values.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {CATALOG_IMPORT_FIELDS.map(field => (
          <div className="space-y-2" key={field.key}>
            <Label htmlFor={`catalog-map-${field.key}`}>{field.label}{field.key === "sku" || field.key === "name" ? " *" : ""}</Label>
            <Select disabled={disabled} value={mapping[field.key] ? `column:${mapping[field.key]}` : "unmapped"}
              onValueChange={value => {
                const next = { ...mapping }
                if (value === "unmapped") delete next[field.key]
                else next[field.key] = value.slice("column:".length)
                onMappingChange(next)
              }}>
              <SelectTrigger id={`catalog-map-${field.key}`}><SelectValue placeholder="Do not import" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unmapped">Do not import</SelectItem>
                {headers.map(header => <SelectItem key={header} value={`column:${header}`}>{header}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="catalog-default-currency">Default currency for new products</Label>
        <Input id="catalog-default-currency" className="max-w-40" value={defaultCurrency} disabled={disabled}
          maxLength={3} onChange={event => onCurrencyChange(event.target.value.toUpperCase())} aria-describedby="catalog-currency-help" />
        <p id="catalog-currency-help" className="text-sm text-muted-foreground">USD is the explicit default. Choose a three-letter currency code (for example, USD, EUR, or MXN). A nonempty mapped currency takes precedence; existing products keep their currency when none is supplied.</p>
      </div>
      <p className="text-sm text-muted-foreground">Categories must exactly match an existing active category. Create categories first or leave category unmapped. Only products are imported; inventory, variants, and other item types are not included.</p>
    </div>
  )
}