"use client"

import { useState } from "react"
import { CatalogItem } from "@/app/types"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Plus, Trash2 } from "@/app/components/ui/icons"
import { getAttributeFieldsForItem, AttributeField } from "../product-details"
import { ImageUpload } from "@/app/components/ui/image-upload"
import { useLocalization } from "@/app/context/LocalizationContext"

import { ActionFooter } from "@/app/components/ui/card-footer"

interface Props {
  formData: Partial<CatalogItem>;
  setFormData: (val: Partial<CatalogItem>) => void;
  handleSave: () => void;
  saving: boolean;
}

export function CatalogItemDetailsMarketingCard({ formData, setFormData, handleSave, saving }: Props) {
  const { t } = useLocalization();
  const metadata = formData.metadata || {};
  const gallery = Array.isArray(metadata.gallery) ? metadata.gallery : [];
  const videos: { url: string; title?: string }[] = Array.isArray(metadata.videos) ? metadata.videos : [];
  const hashtags = Array.isArray(metadata.hashtags) ? metadata.hashtags : [];
  const specs: { label: string; value: string }[] = Array.isArray(metadata.specs) ? metadata.specs : [];
  const attributes = metadata.attributes || {};

  const attributeFields = formData.kind ? getAttributeFieldsForItem(formData as CatalogItem) : [];

  const updateMetadata = (key: string, value: any) => {
    setFormData({
      ...formData,
      metadata: {
        ...(formData.metadata || {}),
        [key]: value
      }
    });
  }

  const updateAttribute = (key: AttributeField, value: string) => {
    setFormData({
      ...formData,
      metadata: {
        ...(formData.metadata || {}),
        attributes: {
          ...(formData.metadata?.attributes || {}),
          [key]: value
        }
      }
    });
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle>{t('marketplace.catalogDetails.richDetails') || 'Rich Details & Marketing'}</SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent className="space-y-8">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{t('marketplace.catalogDetails.galleryTitle') || 'Gallery (Extra Images)'}</Label>
            <Button variant="outline" size="sm" onClick={() => updateMetadata('gallery', [...gallery, ''])}>
              <Plus className="w-4 h-4 mr-2" /> Add Image
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {gallery.map((url: string, idx: number) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="flex-1">
                  <ImageUpload 
                    value={url} 
                    onChange={val => {
                      const newG = [...gallery];
                      newG[idx] = val;
                      updateMetadata('gallery', newG);
                    }} 
                    onRemove={() => {
                      const newG = [...gallery];
                      newG[idx] = '';
                      updateMetadata('gallery', newG);
                    }} 
                  />
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                  const newG = gallery.filter((_: any, i: number) => i !== idx);
                  updateMetadata('gallery', newG);
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Videos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{t('marketplace.catalogDetails.videosTitle') || 'Videos (YouTube, Vimeo, etc.)'}</Label>
            <Button variant="outline" size="sm" onClick={() => updateMetadata('videos', [...videos, { url: '' }])} className="w-max">
              <Plus className="w-4 h-4 mr-2" /> {t('marketplace.catalogDetails.addVideo') || 'Add Video'}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {videos.map((vid: any, idx: number) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <Input 
                    placeholder="Video URL" 
                    value={vid.url || ''} 
                    onChange={e => {
                      const newV = [...videos];
                      newV[idx] = { ...newV[idx], url: e.target.value };
                      updateMetadata('videos', newV);
                    }}
                  />
                  <Input 
                    placeholder="Video Title (Optional)" 
                    value={vid.title || ''} 
                    onChange={e => {
                      const newV = [...videos];
                      newV[idx] = { ...newV[idx], title: e.target.value };
                      updateMetadata('videos', newV);
                    }}
                  />
                </div>
                <Button variant="ghost" size="icon" className="text-destructive mt-1" onClick={() => {
                  const newV = videos.filter((_: any, i: number) => i !== idx);
                  updateMetadata('videos', newV);
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{t('marketplace.catalogDetails.hashtags') || 'Hashtags'}</Label>
            <Button variant="outline" size="sm" onClick={() => updateMetadata('hashtags', [...hashtags, ''])} className="w-max">
              <Plus className="w-4 h-4 mr-2" /> {t('marketplace.catalogDetails.addHashtag') || 'Add Hashtag'}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {hashtags.map((tag: string, idx: number) => (
              <div key={idx} className="flex gap-2">
                <Input 
                  placeholder="e.g. yoga, online-course" 
                  value={tag || ''} 
                  onChange={e => {
                    const newH = [...hashtags];
                    newH[idx] = e.target.value.replace(/^#/, '');
                    updateMetadata('hashtags', newH);
                  }}
                />
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                  const newH = hashtags.filter((_: any, i: number) => i !== idx);
                  updateMetadata('hashtags', newH);
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Specs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{t('marketplace.catalogDetails.customSpecs') || 'Custom Specifications'}</Label>
            <Button variant="outline" size="sm" onClick={() => updateMetadata('specs', [...specs, { label: '', value: '' }])} className="w-max">
              <Plus className="w-4 h-4 mr-2" /> {t('marketplace.catalogDetails.addSpec') || 'Add Spec'}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {specs.map((spec: any, idx: number) => (
              <div key={idx} className="flex gap-2">
                <Input 
                  placeholder="Label (e.g. Resolution)" 
                  value={spec.label || ''} 
                  onChange={e => {
                    const newS = [...specs];
                    newS[idx] = { ...newS[idx], label: e.target.value };
                    updateMetadata('specs', newS);
                  }}
                />
                <Input 
                  placeholder="Value (e.g. 1080p)" 
                  value={spec.value || ''} 
                  onChange={e => {
                    const newS = [...specs];
                    newS[idx] = { ...newS[idx], value: e.target.value };
                    updateMetadata('specs', newS);
                  }}
                />
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                  const newS = specs.filter((_: any, i: number) => i !== idx);
                  updateMetadata('specs', newS);
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Type-Specific Attributes */}
        {attributeFields.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-base font-semibold">{t('marketplace.catalogDetails.attributes') || 'Product Attributes'}</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attributeFields.map(field => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field.replace('_', ' ')}</Label>
                  <Input 
                    value={attributes[field] || ''} 
                    onChange={e => updateAttribute(field, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCardContent>
      <ActionFooter>
        <Button variant="outline" type="button" onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </ActionFooter>
    </SectionCard>
  );
}