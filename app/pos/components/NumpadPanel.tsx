"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { PosCartItem } from "./CartPanel";

interface NumpadPanelProps {
  selectedCartItemId: string | null;
  cart: PosCartItem[];
  setItemQty: (id: string, qty: number) => void;
  setItemPrice: (id: string, price: number) => void;
  t: (key: string) => string;
}

export function NumpadPanel({
  selectedCartItemId,
  cart,
  setItemQty,
  setItemPrice,
  t,
}: NumpadPanelProps) {
  const [mode, setMode] = useState<"qty" | "price">("qty");
  const [inputVal, setInputVal] = useState("");
  const [isNewEntry, setIsNewEntry] = useState(true);

  // Reset when selecting a different item or changing mode
  useEffect(() => {
    setInputVal("");
    setIsNewEntry(true);
  }, [selectedCartItemId, mode]);

  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  const handleModeChange = (newMode: "qty" | "price") => {
    setMode(newMode);
  };

  const applyValue = (valStr: string) => {
    if (!selectedCartItemId) return;
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      if (mode === "qty") {
        setItemQty(selectedCartItemId, parsed);
      } else {
        setItemPrice(selectedCartItemId, parsed);
      }
    } else if (valStr === "" || valStr === "-") {
      // If backspaced everything, we can set to 0 visually
      if (mode === "qty") {
        setItemQty(selectedCartItemId, 0);
      } else {
        setItemPrice(selectedCartItemId, 0);
      }
    }
  };

  const handleDigit = (d: string) => {
    if (!selectedCartItemId) return;

    let newVal;
    if (isNewEntry) {
      newVal = d === "." ? "0." : d;
      setIsNewEntry(false);
    } else {
      newVal = inputVal + d;
    }

    setInputVal(newVal);
    applyValue(newVal);
  };

  const handleClear = () => {
    if (!selectedCartItemId) return;
    setInputVal("");
    setIsNewEntry(true);
    applyValue("");
  };

  const handleBackspace = () => {
    if (!selectedCartItemId || isNewEntry) return;

    const newVal = inputVal.slice(0, -1);
    setInputVal(newVal);
    applyValue(newVal);
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-3 grid grid-cols-3 gap-2">
          {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "C"].map(
            (d) => (
              <Button
                key={d}
                variant={d === "C" ? "destructive" : "outline"}
                className={`aspect-square !p-0 h-auto !min-w-0 text-xl font-medium !rounded-full ${
                  d === "C"
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive border-transparent"
                    : "bg-card"
                }`}
                onClick={() => (d === "C" ? handleClear() : handleDigit(d))}
              >
                {d}
              </Button>
            ),
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="flex-1 aspect-square !p-0 h-auto !min-w-0 !rounded-full bg-card"
            onClick={handleBackspace}
            disabled={!selectedCartItemId}
          >
            ⌫
          </Button>
          <Button
            variant={mode === "qty" ? "default" : "secondary"}
            className="flex-1 aspect-square !p-0 h-auto !min-w-0 !rounded-full text-xs font-medium"
            onClick={() => handleModeChange("qty")}
            disabled={!selectedCartItemId}
          >
            {getTrans("pos.cart.numpadQty", "Qty")}
          </Button>
          <Button
            variant={mode === "price" ? "default" : "secondary"}
            className="flex-1 aspect-square !p-0 h-auto !min-w-0 !rounded-full text-xs font-medium"
            onClick={() => handleModeChange("price")}
            disabled={!selectedCartItemId}
          >
            {getTrans("pos.cart.numpadPrice", "Price")}
          </Button>
        </div>
      </div>
    </div>
  );
}
