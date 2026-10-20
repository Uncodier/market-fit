import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Label } from "@/app/components/ui/label"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Download } from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { catalogImportErrorsCsv } from "../import-file"
import type { ImportCatalogReview as Review } from "./ImportCatalogState"
import type { ImportCatalogError, ImportCatalogMode } from "./ImportCatalogRunner"

export function ImportCatalogErrors({ errors }: { errors: ImportCatalogError[] }) {
  if (!errors.length) return null
  const download = () => {
    const url = URL.createObjectURL(new Blob([catalogImportErrorsCsv(errors)], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "catalog-import-errors.csv"
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <section className="space-y-2 rounded-md border p-3" aria-label="Import errors">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{errors.length.toLocaleString()} row errors</h3>
        <Button variant="outline" size="sm" onClick={download}><Download className="mr-2 h-4 w-4" />Download error CSV</Button>
      </div>
      <p className="text-sm text-muted-foreground">Showing the first {Math.min(errors.length, 50)} errors. The download includes every error with its source row number.</p>
      <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
        {errors.slice(0, 50).map((error, index) => <li key={`${error.rowNumber}:${index}`}>Row {error.rowNumber}: {error.message}</li>)}
      </ul>
    </section>
  )
}

interface Props {
  review: Review
  mode: ImportCatalogMode
  onModeChange: (mode: ImportCatalogMode) => void
  acknowledged: boolean
  onAcknowledge: (acknowledged: boolean) => void
}

export function ImportCatalogReview({ review, mode, onModeChange, acknowledged, onAcknowledge }: Props) {
  const errors = review.errors
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{review.rows.length.toLocaleString()} normalized rows</Badge>
        <Badge variant="secondary">{review.existingSkus.length.toLocaleString()} existing SKUs</Badge>
        <Badge variant={errors.length ? "destructive" : "secondary"}>{errors.length.toLocaleString()} row errors</Badge>
      </div>
      <p className="text-sm text-muted-foreground">No changes have been made. Review the first 10 normalized rows below. Existing SKU and category checks are a preview; the server checks each batch again when importing.</p>
      <p className="text-sm text-muted-foreground">New products are not automatically published to the marketplace or POS. Existing status and sales channels are preserved; review sales channels after importing.</p>
      <div className="space-y-2">
        <Label htmlFor="catalog-import-mode">When an SKU already exists</Label>
        <Select value={mode} onValueChange={value => onModeChange(value as ImportCatalogMode)}>
          <SelectTrigger id="catalog-import-mode"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="skip">Skip existing SKUs (recommended)</SelectItem>
            <SelectItem value="update">Update existing products</SelectItem>
          </SelectContent>
        </Select>
        {mode === "update" && <p className="text-sm text-amber-700 dark:text-amber-400">Update is enabled. Supplied fields will overwrite existing product values; omitted optional fields will be preserved.</p>}
      </div>
      <p className="text-sm text-muted-foreground">Categories are matched by name, ignoring case and extra spaces. Missing categories are created as active categories when importing; archived categories are never reused or restored.</p>
      {!!review.missingCategories.length && <p className="text-sm text-muted-foreground">{review.missingCategories.length.toLocaleString()} new categories will be created as needed for imported rows.</p>}
      {!!review.ambiguousCategories.length && <p className="text-sm text-destructive">{review.ambiguousCategories.length.toLocaleString()} category names match multiple active categories. Rows referencing them will be rejected. Resolve the duplicate names or unmap category before importing.</p>}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Price</TableHead><TableHead>Currency</TableHead><TableHead>Category</TableHead></TableRow></TableHeader>
          <TableBody>{review.rows.slice(0, 10).map(row => <TableRow key={row.rowNumber}>
            <TableCell>{row.rowNumber}</TableCell><TableCell>{row.item.sku}</TableCell><TableCell>{row.item.name}</TableCell>
            <TableCell>{row.item.target_sale_price ?? "—"}</TableCell><TableCell>{row.item.currency ?? `New product default: ${row.defaultCurrency ?? "USD"}; existing unchanged`}</TableCell><TableCell>{row.category ?? "—"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      <ImportCatalogErrors errors={errors} />
      <div className="flex items-start gap-2 rounded-md border p-3">
        <Checkbox id="catalog-review-confirm" checked={acknowledged} onCheckedChange={value => onAcknowledge(value === true)} />
        <Label htmlFor="catalog-review-confirm" className="text-sm leading-relaxed">I have reviewed the preview, import mode, and any errors. Import the valid rows; invalid rows will not be imported.</Label>
      </div>
      <p className="text-sm text-muted-foreground">Keep this dialog open until the import completes. Imports run in sequential batches of up to 100 rows, not in the background. Stop takes effect between batches; already committed changes cannot be undone here.</p>
    </div>
  )
}