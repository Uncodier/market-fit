"use client"

import { CatalogItem } from "@/app/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { updateCatalogAvailability } from "../actions"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Archive, DatabaseIcon, Edit } from "@/app/components/ui/icons"
import Link from "next/link"

interface CatalogTableProps {
  items: CatalogItem[]
  onUpdate: () => void
}

export function CatalogTable({ items, onUpdate }: CatalogTableProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()

  const handleAvailabilityChange = async (item: CatalogItem, newStatus: string) => {
    if (!currentSite) return
    const promise = updateCatalogAvailability(currentSite.id, item.id, { 
      availability_status: newStatus as any 
    })
    
    toast.promise(promise, {
      loading: 'Updating availability...',
      success: 'Availability updated',
      error: 'Failed to update availability'
    })

    await promise
    onUpdate()
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead>{t('catalog.name') || 'Name & SKU'}</TableHead>
          <TableHead>{t('catalog.price') || 'Target Price'}</TableHead>
          <TableHead>{t('catalog.mode') || 'Availability Mode'}</TableHead>
          <TableHead>{t('catalog.status') || 'Sellable Status'}</TableHead>
          <TableHead className="w-16"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className={item.status === 'archived' ? 'opacity-60' : ''}>
            <TableCell>
              {item.kind === 'product' ? (
                <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center text-blue-600">
                  <Archive className="h-4 w-4" />
                </div>
              ) : (
                <div className="h-8 w-8 rounded bg-purple-50 flex items-center justify-center text-purple-600">
                  <DatabaseIcon className="h-4 w-4" />
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="font-medium text-foreground">{item.name}</div>
              {item.sku && <div className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku}</div>}
            </TableCell>
            <TableCell>
              <div className="text-foreground">
                {item.target_sale_price != null 
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.target_sale_price)
                  : <span className="text-muted-foreground">-</span>
                }
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="capitalize">
                {item.availability_mode}
              </Badge>
              {item.track_inventory && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Tracks Stock
                </Badge>
              )}
            </TableCell>
            <TableCell>
              {item.availability_mode === 'manual' ? (
                <Select 
                  value={item.availability_status} 
                  onValueChange={(val) => handleAvailabilityChange(item, val)}
                  disabled={item.status === 'archived'}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span>Available</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="sold_out">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                        <span>Sold Out</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="unavailable">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500"></div>
                        <span>Unavailable</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : item.availability_mode === 'always' ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                  Always Sellable
                </Badge>
              ) : (
                <Badge variant="outline">
                  Auto (Inventory)
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <Link 
                href={`/catalog/${item.id}`} 
                className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <Edit className="h-4 w-4" />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
