import { CatalogItem } from "@/app/types";
import { VariantAxisKind } from "@/app/types";

export type VariantWidgetType = 'chips' | 'swatches' | 'select' | 'radio';

export interface VariantAxisDefinition {
  kind: VariantAxisKind;
  defaultLabelKey: string; // fallback i18n key
  widget: VariantWidgetType;
  defaultValues?: { id: string; label: string }[];
}

export const VARIANT_AXES_CATALOG: Record<VariantAxisKind, VariantAxisDefinition> = {
  size: {
    kind: 'size',
    defaultLabelKey: 'catalog.variants.axis.size',
    widget: 'chips',
    defaultValues: [
      { id: 's', label: 'S' },
      { id: 'm', label: 'M' },
      { id: 'l', label: 'L' },
      { id: 'xl', label: 'XL' },
    ]
  },
  color: {
    kind: 'color',
    defaultLabelKey: 'catalog.variants.axis.color',
    widget: 'swatches',
  },
  brand: {
    kind: 'brand',
    defaultLabelKey: 'catalog.variants.axis.brand',
    widget: 'select',
  },
  condition: {
    kind: 'condition',
    defaultLabelKey: 'catalog.variants.axis.condition',
    widget: 'chips',
    defaultValues: [
      { id: 'new', label: 'New' },
      { id: 'used', label: 'Used' },
      { id: 'refurbished', label: 'Refurbished' },
    ]
  },
  material: {
    kind: 'material',
    defaultLabelKey: 'catalog.variants.axis.material',
    widget: 'select',
  },
  style: {
    kind: 'style',
    defaultLabelKey: 'catalog.variants.axis.style',
    widget: 'select',
  },
  pack: {
    kind: 'pack',
    defaultLabelKey: 'catalog.variants.axis.pack',
    widget: 'chips',
  },
  duration: {
    kind: 'duration',
    defaultLabelKey: 'catalog.variants.axis.duration',
    widget: 'chips',
    defaultValues: [
      { id: '30m', label: '30 min' },
      { id: '60m', label: '60 min' },
      { id: '90m', label: '90 min' },
    ]
  },
  capacity: {
    kind: 'capacity',
    defaultLabelKey: 'catalog.variants.axis.capacity',
    widget: 'chips',
    defaultValues: [
      { id: 'individual', label: 'Individual' },
      { id: 'duo', label: 'Duo' },
      { id: 'group', label: 'Group' },
    ]
  },
  format: {
    kind: 'format',
    defaultLabelKey: 'catalog.variants.axis.format',
    widget: 'chips',
  },
  custom: {
    kind: 'custom',
    defaultLabelKey: 'catalog.variants.axis.custom',
    widget: 'chips',
  }
};

export function getSuggestedVariantAxes(item: CatalogItem): VariantAxisKind[] {
  const { kind, digital_subtype } = item;

  if (kind === 'product') {
    return ['size', 'color', 'brand', 'condition', 'material', 'style', 'pack', 'custom'];
  }

  if (kind === 'service') {
    return ['duration', 'capacity', 'style', 'custom'];
  }

  if (kind === 'digital_asset') {
    if (digital_subtype === 'course') {
      return ['format', 'duration', 'custom'];
    }
    if (digital_subtype === 'license') {
      return ['format', 'capacity', 'custom'];
    }
    return ['format', 'custom'];
  }

  return ['custom'];
}

export function getVariantWidgetForKind(kind: VariantAxisKind): VariantWidgetType {
  return VARIANT_AXES_CATALOG[kind]?.widget || 'chips';
}
