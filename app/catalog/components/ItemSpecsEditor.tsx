"use client"

import React, { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Plus, Trash2 } from "@/app/components/ui/icons"
import { ImageUpload } from "@/app/components/ui/image-upload"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { CatalogItem, ItemSpec, ItemSpecCategory } from "@/app/types"
import { 
  listItemSpecCategories, 
  ensureDefaultItemSpecCategories,
  createItemSpecCategory,
  listItemSpecs,
  findOrCreateItemSpec,
  upsertItemSpec,
  setCatalogItemSpecs,
  listCatalogItemSpecs
} from "../item-spec-actions"
import { getDefaultSpecCategorySlugsForItem } from "../product-details"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { toast } from "sonner"
import { ActionFooter } from "@/app/components/ui/card-footer"

interface Props {
  catalogItemId: string;
  item: CatalogItem;
  handleSave: () => void;
  saving: boolean;
}

export function ItemSpecsEditor({ catalogItemId, item, handleSave, saving }: Props) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [categories, setCategories] = useState<ItemSpecCategory[]>([])
  const [allSpecs, setAllSpecs] = useState<ItemSpec[]>([])
  const [itemSpecs, setItemSpecs] = useState<ItemSpec[]>([])
  const [loading, setLoading] = useState(true)

  const defaultSlugs = getDefaultSpecCategorySlugsForItem(item)
  
  useEffect(() => {
    async function load() {
      if (!currentSite) return
      
      await ensureDefaultItemSpecCategories(currentSite.id)
      const [catsRes, specsRes, itemSpecsRes] = await Promise.all([
        listItemSpecCategories(currentSite.id),
        listItemSpecs(currentSite.id),
        listCatalogItemSpecs(catalogItemId)
      ])
      
      if (catsRes.data) setCategories(catsRes.data)
      if (specsRes.data) setAllSpecs(specsRes.data)
      if (itemSpecsRes.data) {
        setItemSpecs(itemSpecsRes.data.map((cis: any) => cis.item_spec))
      }
      setLoading(false)
    }
    load()
  }, [currentSite, catalogItemId])

  // Lazy migration
  useEffect(() => {
    if (loading || !currentSite || !item.metadata?.attributes) return;

    const attributes = item.metadata.attributes as any;
    let didMigrate = false;
    const migrateMap: Record<string, string> = {
      venue: 'venue',
      instructor: 'instructor',
      brand: 'brand'
    };

    const migrate = async () => {
      for (const [attrKey, catSlug] of Object.entries(migrateMap)) {
        const val = attributes[attrKey];
        if (val && typeof val === 'string' && val.trim()) {
          const cat = categories.find(c => c.slug === catSlug);
          if (cat) {
            // Check if already linked
            const alreadyLinked = itemSpecs.some(s => s.category_id === cat.id);
            if (!alreadyLinked) {
              const res = await findOrCreateItemSpec(currentSite.id, cat.id, val.trim());
              if (res.data) {
                // If it's venue, try to migrate address and city too
                if (catSlug === 'venue' && (attributes.address || attributes.city)) {
                  if (!res.data.address && !res.data.city) { // Don't overwrite if spec already has it
                    await upsertItemSpec({
                      ...res.data,
                      address: attributes.address || res.data.address,
                      city: attributes.city || res.data.city,
                      site_id: currentSite.id,
                      category_id: cat.id,
                      name: res.data.name
                    });
                  }
                }
                
                setItemSpecs(prev => {
                  if (!prev.find(p => p.id === res.data!.id)) {
                    const next = [...prev, res.data!];
                    // Don't call server action inside render-triggered useEffect
                    // We'll queue it up or just wait to save
                    setCatalogItemSpecs(catalogItemId, next.map(n => n.id)).catch(console.error);
                    return next;
                  }
                  return prev;
                });
                didMigrate = true;
              }
            }
          }
        }
      }
    };

    migrate();
  }, [loading, currentSite, item.metadata?.attributes, categories, catalogItemId]);

  const handleAddCustomCategory = async () => {
    if (!currentSite) return
    const name = window.prompt("Enter new category name (e.g. Writer, Team):")
    if (!name?.trim()) return
    const res = await createItemSpecCategory(currentSite.id, name)
    if (res.error) toast.error(res.error)
    else if (res.data) {
      setCategories([...categories, res.data])
    }
  }

  const handleSpecSelect = async (cat: ItemSpecCategory, val: RelationSelectValue) => {
    if (!currentSite) return
    if (!val) {
      // Remove all specs of this category? Or if multi, need index.
      // Wait, relation select clears when null, but let's handle clear below.
      return
    }

    const { id, error } = await resolveRelationId("item_spec", val, currentSite.id, { categoryId: cat.id })
    if (error) {
      toast.error(error)
      return
    }

    if (id) {
      const match = allSpecs.find(s => s.id === id) || (await listItemSpecs(currentSite.id)).data?.find((s: any) => s.id === id)
      if (match) {
        // If single (all except artist and custom), replace existing for this category
        const isMulti = cat.slug === 'artist' || !cat.is_system
        
        let next: ItemSpec[] = []
        if (isMulti) {
          if (!itemSpecs.find(s => s.id === match.id)) {
            next = [...itemSpecs, match]
          } else {
            next = itemSpecs
          }
        } else {
          next = [...itemSpecs.filter(s => s.category_id !== cat.id), match]
        }
        
        setItemSpecs(next)
        setCatalogItemSpecs(catalogItemId, next.map(n => n.id))
      }
    }
  }

  const handleRemoveSpec = async (specId: string) => {
    const next = itemSpecs.filter(s => s.id !== specId)
    setItemSpecs(next)
    const res = await setCatalogItemSpecs(catalogItemId, next.map(n => n.id))
    if (res.error) toast.error(res.error)
  }

  const handleUpdateSpecMedia = async (spec: ItemSpec, field: 'image_url' | 'video_url' | 'address' | 'city', val: string) => {
    if (!currentSite) return
    const nextSpec = { ...spec, [field]: val }
    
    // Optimistic UI update
    setItemSpecs(prev => prev.map(s => s.id === spec.id ? nextSpec : s))
    setAllSpecs(prev => prev.map(s => s.id === spec.id ? nextSpec : s))

    const res = await upsertItemSpec({
      id: spec.id,
      site_id: currentSite.id,
      category_id: spec.category_id,
      name: spec.name,
      [field]: val
    })

    if (res.error) {
      toast.error(res.error)
      // Revert on error (could be better, but fine for now)
      setItemSpecs(prev => prev.map(s => s.id === spec.id ? spec : s))
    }
  }

  // Categories to show: System defaults for this kind, plus any category that has a selected spec, plus custom categories.
  const categoriesToShow = categories.filter(c => 
    (!c.is_system) || 
    defaultSlugs.includes(c.slug) || 
    itemSpecs.some(s => s.category_id === c.id)
  )

  return (
    <SectionCard>
      <SectionCardHeader>
        <div className="flex items-center justify-between">
          <SectionCardTitle>{t('marketplace.catalogDetails.entities') || 'Entities & Collections'}</SectionCardTitle>
          {!loading && (
            <Button variant="outline" size="sm" onClick={handleAddCustomCategory}>
              <Plus className="w-4 h-4 mr-2" /> Add Custom Category
            </Button>
          )}
        </div>
      </SectionCardHeader>
      <SectionCardContent>
        {loading ? (
          <div className="space-y-8">
            {[0, 1].map((i) => (
              <div key={i} className={i > 0 ? "pt-8 border-t" : ""}>
                <div className="mb-6">
                  <div className="h-6 w-28 bg-muted/50 rounded animate-pulse" />
                </div>
                <div className="space-y-4">
                  <div className="h-10 w-full md:w-1/2 bg-muted/50 rounded animate-pulse" />
                  <div className="h-10 w-full bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          categoriesToShow.map((cat, index) => {
            const isMulti = cat.slug === 'artist' || !cat.is_system
            const selectedForCat = itemSpecs.filter(s => s.category_id === cat.id)

            const options = allSpecs
              .filter(s => s.category_id === cat.id)
              .map(s => ({ id: s.id, label: s.name }))

            return (
              <div key={cat.id} className={index > 0 ? "pt-8 border-t mt-8" : ""}>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg capitalize">{cat.name}</h3>
                    {selectedForCat.length > 0 && (
                      <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {selectedForCat.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  {(!isMulti && selectedForCat.length > 0) ? null : (
                    <div className="w-full md:w-1/2">
                      <RelationSelect
                        options={options}
                        value={null}
                        onValueChange={(val) => handleSpecSelect(cat, val)}
                        placeholder={`Select or create ${cat.name.toLowerCase()}...`}
                        clearAfterSelect={true}
                      />
                    </div>
                  )}

                  {selectedForCat.length > 0 && (
                    <div className="space-y-6">
                      {selectedForCat.map((spec, specIndex) => (
                        <div key={spec.id} className={`relative ${isMulti && specIndex > 0 ? 'pt-6 border-t mt-6' : ''}`}>
                          <div className="flex items-start gap-4">
                            <div className="flex-1 space-y-4">
                              <div className="space-y-2">
                                <Label>{t('catalog.specs.name') || 'Name'}</Label>
                                <Input 
                                  value={spec.name || ''} 
                                  onChange={e => handleUpdateSpecMedia(spec, 'name' as any, e.target.value)}
                                  placeholder={`e.g. ${cat.name}`}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>{t('catalog.specs.image') || 'Image'}</Label>
                                <ImageUpload 
                                  value={spec.image_url || ''} 
                                  onChange={val => handleUpdateSpecMedia(spec, 'image_url', val)} 
                                  onRemove={() => handleUpdateSpecMedia(spec, 'image_url', '')} 
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>{t('catalog.specs.videoUrl') || 'Video URL'}</Label>
                                <Input 
                                  value={spec.video_url || ''} 
                                  onChange={e => handleUpdateSpecMedia(spec, 'video_url', e.target.value)}
                                  placeholder="https://..."
                                />
                              </div>
                              
                              {cat.slug === 'venue' && (
                                <>
                                  <div className="space-y-2">
                                    <Label>{t('catalog.specs.address') || 'Address'}</Label>
                                    <Input 
                                      value={spec.address || ''} 
                                      onChange={e => handleUpdateSpecMedia(spec, 'address', e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{t('catalog.specs.city') || 'City'}</Label>
                                    <Input 
                                      value={spec.city || ''} 
                                      onChange={e => handleUpdateSpecMedia(spec, 'city', e.target.value)}
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                            
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive mt-8 shrink-0"
                              onClick={() => handleRemoveSpec(spec.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </SectionCardContent>
      <ActionFooter>
        <Button variant="outline" type="button" onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save Behaviors"}
        </Button>
      </ActionFooter>
    </SectionCard>
  )
}
