"use client";

import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import type { PosShippingAddress } from "@/app/pos/shipping-address";

type Props = {
  value: PosShippingAddress;
  onChange: (value: PosShippingAddress) => void;
  t: (key: string) => string;
};

export function PosShippingAddressFields({ value, onChange, t }: Props) {
  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  const patch = (partial: Partial<PosShippingAddress>) =>
    onChange({ ...value, ...partial });

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">
        {getTrans("checkout.shippingAddress", "Shipping Address")}
      </Label>
      <Input
        placeholder={getTrans("checkout.streetAddress", "Street Address")}
        value={value.line1}
        onChange={(e) => patch({ line1: e.target.value })}
        className="bg-card"
      />
      <Input
        placeholder={getTrans("checkout.aptSuite", "Apt, Suite, etc. (optional)")}
        value={value.line2}
        onChange={(e) => patch({ line2: e.target.value })}
        className="bg-card"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder={getTrans("checkout.city", "City")}
          value={value.city}
          onChange={(e) => patch({ city: e.target.value })}
          className="bg-card"
        />
        <Input
          placeholder={getTrans("checkout.state", "State")}
          value={value.state}
          onChange={(e) => patch({ state: e.target.value })}
          className="bg-card"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder={getTrans("checkout.zipCode", "ZIP Code")}
          value={value.zip}
          onChange={(e) => patch({ zip: e.target.value })}
          className="bg-card"
        />
        <Input
          placeholder={getTrans("checkout.country", "Country")}
          value={value.country}
          onChange={(e) => patch({ country: e.target.value })}
          className="bg-card"
        />
      </div>
    </div>
  );
}
