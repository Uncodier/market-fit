"use client"

import { useEffect, useState } from "react"
import { CatalogItem, Location } from "@/app/types"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Truck } from "@/app/components/ui/icons"
import { getItemDeliveryOptions, CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options"
import { listLocations } from "@/app/inventory/actions"

interface Props {
  formData: Partial<CatalogItem>;
  setFormData: (val: Partial<CatalogItem>) => void;
  handleSave: () => void;
  saving: boolean;
}

export function ProductDeliveryOptionsCard({ formData, setFormData, handleSave, saving }: Props) {
  const { t } = useLocalization();
  const { currentSite } = useSite();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const currentOptions = getItemDeliveryOptions(formData);
  const metadata = formData.metadata || {};
  const pickupLocationIds = Array.isArray(metadata.pickup_location_ids)
    ? metadata.pickup_location_ids
    : [];

  const hasDelivery = currentOptions.includes('pickup') || currentOptions.includes('ship') || currentOptions.includes('dine_in');
  const hasPickup = currentOptions.includes('pickup');
  const hasShip = currentOptions.includes('ship');
  const hasDineIn = currentOptions.includes('dine_in');

  useEffect(() => {
    async function load() {
      if (!currentSite?.id) return;
      setLoadingLocations(true);
      const { data } = await listLocations(currentSite.id);
      setLocations((data || []).filter((l) => l.is_active !== false));
      setLoadingLocations(false);
    }
    load();
  }, [currentSite?.id]);

  const updateDelivery = (
    options: CheckoutFulfillmentMethod[],
    nextPickupIds?: string[]
  ) => {
    const pickupIds = nextPickupIds !== undefined
      ? nextPickupIds
      : (options.includes('pickup') ? pickupLocationIds : []);

    setFormData({
      ...formData,
      metadata: {
        ...metadata,
        delivery_options: options,
        pickup_location_ids: options.includes('pickup') ? pickupIds : [],
      }
    });
  };

  const setHasDelivery = (enabled: boolean) => {
    if (!enabled) {
      updateDelivery(['none'], []);
      return;
    }
    // Enable physical delivery with both methods by default
    updateDelivery(['pickup', 'ship']);
  };

  const setMethod = (method: 'pickup' | 'ship' | 'dine_in', enabled: boolean) => {
    let next = currentOptions.filter((o) => o !== 'none') as CheckoutFulfillmentMethod[];
    if (enabled && !next.includes(method)) {
      next = [...next, method];
    } else if (!enabled) {
      next = next.filter((o) => o !== method);
    }
    // Keep at least one physical method while hasDelivery is on
    if (next.length === 0) {
      next = [method === 'pickup' ? 'ship' : 'pickup']; // Note: if last removed was dine_in, defaults to pickup.
    }
    updateDelivery(next, method === 'pickup' && !enabled ? [] : undefined);
  };

  const togglePickupLocation = (locationId: string, enabled: boolean) => {
    let next = [...pickupLocationIds];
    if (enabled && !next.includes(locationId)) {
      next.push(locationId);
    } else if (!enabled) {
      next = next.filter((id) => id !== locationId);
    }
    updateDelivery(currentOptions, next);
  };

  return (
    <Card id="product-delivery-options" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5" /> {t('catalog.deliveryOptions.title') || 'Delivery Options'}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 md:px-8 pb-8 space-y-6">
        <p className="text-sm text-muted-foreground">
          {t('catalog.deliveryOptions.description') || 'Configure whether this item can be shipped or picked up in store.'}
        </p>

        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="has_delivery" className="text-base cursor-pointer">
              {t('catalog.deliveryOptions.hasDelivery') || 'Has Delivery'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('catalog.deliveryOptions.hasDeliveryHint') || 'Enable shipping and/or store pickup for this item.'}
            </p>
          </div>
          <Switch
            id="has_delivery"
            checked={hasDelivery}
            onCheckedChange={setHasDelivery}
          />
        </div>

        {hasDelivery && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="delivery_ship" className="text-base cursor-pointer">
                  {t('catalog.deliveryOptions.ship') || 'Ship to Customer'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('catalog.deliveryOptions.shipHint') || 'Buyers can enter a shipping address at checkout.'}
                </p>
              </div>
              <Switch
                id="delivery_ship"
                checked={hasShip}
                onCheckedChange={(checked) => setMethod('ship', !!checked)}
              />
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="delivery_pickup" className="text-base cursor-pointer">
                  {t('catalog.deliveryOptions.pickup') || 'Store Pickup'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('catalog.deliveryOptions.pickupHint') || 'Buyers can pick up at selected locations.'}
                </p>
              </div>
              <Switch
                id="delivery_pickup"
                checked={hasPickup}
                onCheckedChange={(checked) => setMethod('pickup', !!checked)}
              />
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="delivery_dine_in" className="text-base cursor-pointer">
                  {t('catalog.deliveryOptions.dineIn') || 'Consume Here'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('catalog.deliveryOptions.dineInHint') || 'Buyers consume their order at your location.'}
                </p>
              </div>
              <Switch
                id="delivery_dine_in"
                checked={hasDineIn}
                onCheckedChange={(checked) => setMethod('dine_in', !!checked)}
              />
            </div>

            {hasPickup && (
              <div className="space-y-3 pt-2">
                <div>
                  <h4 className="text-sm font-medium">
                    {t('catalog.deliveryOptions.pickupLocations') || 'Pickup Locations'}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('catalog.deliveryOptions.pickupLocationsHint') || 'Enable the locations where this item can be picked up. If none are enabled, all active locations are allowed.'}
                  </p>
                </div>

                {loadingLocations ? (
                  <div className="space-y-3">
                    <div className="h-12 bg-muted/50 rounded animate-pulse" />
                    <div className="h-12 bg-muted/50 rounded animate-pulse" />
                  </div>
                ) : locations.length > 0 ? (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full min-w-[400px]">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="px-6 py-3 text-sm font-semibold text-left">
                            {t('catalog.deliveryOptions.locationName') || 'Location'}
                          </th>
                          <th className="px-6 py-3 text-sm font-semibold text-right w-24">
                            {t('catalog.deliveryOptions.enabled') || 'Enabled'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {locations.map((loc) => {
                          const enabled = pickupLocationIds.includes(loc.id);
                          return (
                            <tr key={loc.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-6 py-3 text-sm">
                                <div className="font-medium">{loc.name}</div>
                                {(loc.city || loc.address) && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {[loc.address, loc.city, loc.state].filter(Boolean).join(', ')}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right">
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={(checked) => togglePickupLocation(loc.id, !!checked)}
                                  className="data-[state=checked]:bg-primary"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                    <p className="text-muted-foreground text-sm">
                      {t('catalog.deliveryOptions.noLocations') || 'No locations configured yet. Add locations in Inventory or Settings.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!hasDelivery && (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 bg-muted/20">
            {t('catalog.deliveryOptions.noneHint') || 'This item is treated as digital/service with no shipping or pickup.'}
          </p>
        )}
      </CardContent>
      <ActionFooter>
        <Button type="button" variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? (t('common.saving') || 'Saving...') : (t('common.saveChanges') || 'Save Changes')}
        </Button>
      </ActionFooter>
    </Card>
  )
}
