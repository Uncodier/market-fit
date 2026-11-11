import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { ChevronDown, Loader, Tag, Trash2, Folder } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { RecordCategory } from "../actions"

interface Props {
  selectedRecords: Set<string>
  setSelectedRecords: (value: Set<string>) => void
  isBulkActionLoading: boolean
  categories: RecordCategory[]
  handleBulkStatusChange: (value: string) => void
  handleBulkCategoryChange: (value: string) => void
  handleBulkDelete: () => void
}

export function RecordsBulkToolbar({ selectedRecords, setSelectedRecords, isBulkActionLoading,
  categories, handleBulkStatusChange, handleBulkCategoryChange, handleBulkDelete }: Props) {
  const { t } = useLocalization()
  return (
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="rounded-full px-2 py-0">
                    {selectedRecords.size} {t("records.bulk.selected") || "selected"}
                  </Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {t("records.bulk.chooseAction") || "Choose bulk action"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRecords(new Set())} disabled={isBulkActionLoading}>
                      {t("records.bulk.cancel") || "Cancel"}
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" disabled={isBulkActionLoading}>
                          <Tag className="h-4 w-4" />
                          <span className="hidden sm:inline">{t("records.bulk.changeStatus") || "Change Status"}</span>
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {["draft", "published", "archived"].map(status => (
                          <DropdownMenuItem key={status} onClick={() => handleBulkStatusChange(status)} className="capitalize">
                            {t(`status.${status}`) || status}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" disabled={isBulkActionLoading}>
                          <Folder className="h-4 w-4" />
                          <span className="hidden sm:inline">{t("records.bulk.changeCategory") || "Change Category"}</span>
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {categories.map(category => (
                          <DropdownMenuItem key={category.id} onClick={() => handleBulkCategoryChange(category.id)}>
                            {category.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4 text-destructive hover:text-destructive" onClick={handleBulkDelete} disabled={isBulkActionLoading}>
                      {isBulkActionLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="hidden sm:inline">{t("records.bulk.delete") || "Delete"}</span>
                    </Button>
                  </div>
                </div>
  )
}
