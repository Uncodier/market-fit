"use client";

import React, { useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Plus, X, ArrowRight, ArrowLeft } from "@/app/components/ui/icons";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPortal } from "react-dom";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import { cn } from "@/lib/utils";

type SplitColumn = {
  id: string;
  title: string;
  items: PosCartItem[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalCart: PosCartItem[];
  onConfirm: (columns: SplitColumn[]) => void;
};

type SortableItemProps = {
  item: PosCartItem;
  itemIdx: number;
  colId: string;
  formatPrice: (val: number, currency: string) => string;
  moveItem: (fromColId: string, toColId: string, itemKey: string, qty: number) => void;
  idx: number;
  columnsLength: number;
  prevColId?: string;
  nextColId?: string;
};

function SortableItem({ item, itemIdx, colId, formatPrice, moveItem, idx, columnsLength, prevColId, nextColId }: SortableItemProps) {
  const sortableId = `${colId}::${item.lineKey || item.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, data: { item, colId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-muted/30 p-2 rounded-lg border border-border/50 text-sm cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="font-medium line-clamp-2">{item.name}</div>
      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
        <div>
          {formatPrice(item.cartPrice, item.currency || "USD")} x {item.cartQty}
        </div>
        <div className="flex gap-1" onPointerDown={e => e.stopPropagation()}>
          {idx > 0 && prevColId && (
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => moveItem(colId, prevColId, item.lineKey || item.id, 1)}
              title="Move 1 left"
            >
              <ArrowLeft className="h-3 w-3" />
            </Button>
          )}
          {idx < columnsLength - 1 && nextColId && (
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => moveItem(colId, nextColId, item.lineKey || item.id, 1)}
              title="Move 1 right"
            >
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


type SortableColumnProps = {
  col: SplitColumn;
  idx: number;
  columnsLength: number;
  formatPrice: (val: number, currency: string) => string;
  moveItem: (fromColId: string, toColId: string, itemKey: string, qty: number) => void;
  setColumns: React.Dispatch<React.SetStateAction<SplitColumn[]>>;
  removeColumn: (id: string) => void;
  getTrans: (key: string, fallback: string) => string;
  columns: SplitColumn[];
};

function SortableColumn({ col, idx, columnsLength, formatPrice, moveItem, setColumns, removeColumn, getTrans, columns }: SortableColumnProps) {
  const { setNodeRef } = useDroppable({
    id: col.id,
    data: {
      colId: col.id
    }
  });

  return (
    <div key={col.id} className="w-80 flex flex-col h-full bg-background rounded-xl border shadow-sm flex-shrink-0">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <Input 
          value={col.title}
          onChange={e => {
            const val = e.target.value;
            setColumns(prev => prev.map(c => c.id === col.id ? { ...c, title: val } : c));
          }}
          className="h-8 font-medium bg-transparent border-transparent hover:border-input focus:border-input px-1"
        />
        {columnsLength > 1 && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeColumn(col.id)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-3 space-y-2 relative min-h-[100px]">
        <SortableContext 
          id={col.id}
          items={col.items.map(i => `${col.id}::${i.lineKey || i.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {col.items.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground italic pointer-events-none">
              {getTrans("pos.split.empty", "Empty order")}
            </div>
          ) : (
            col.items.map((item, itemIdx) => (
              <SortableItem
                key={`${col.id}::${item.lineKey || item.id}`}
                item={item}
                itemIdx={itemIdx}
                colId={col.id}
                formatPrice={formatPrice}
                moveItem={moveItem}
                idx={idx}
                columnsLength={columnsLength}
                prevColId={idx > 0 ? columns[idx - 1].id : undefined}
                nextColId={idx < columnsLength - 1 ? columns[idx + 1].id : undefined}
              />
            ))
          )}
        </SortableContext>
      </div>

      <div className="p-3 border-t bg-muted/10 font-medium flex justify-between items-center">
        <span>{getTrans("pos.cart.subtotal", "Subtotal")}</span>
        <span>{formatPrice(col.items.reduce((sum, item) => sum + (item.cartPrice * item.cartQty), 0), "USD")}</span>
      </div>
    </div>
  );
}

export function PosSplitBillDialog({ open, onOpenChange, originalCart, onConfirm }: Props) {
  const { t } = useLocalization();
  const { formatPrice } = useDisplayCurrency();

  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  const [columns, setColumns] = useState<SplitColumn[]>(() => {
    return [
      {
        id: "col-1",
        title: "Order 1",
        items: originalCart.map(item => ({ ...item })), // deep clone top level
      }
    ];
  });

  const [activeDragItem, setActiveDragItem] = useState<{ item: PosCartItem; colId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset when opened
  React.useEffect(() => {
    if (open) {
      setColumns([
        {
          id: "col-1",
          title: `${getTrans("pos.split.orderTitle", "Order")} 1`,
          items: originalCart.map(item => ({ ...item })),
        }
      ]);
    }
  }, [open, originalCart, t]);

  const addColumn = () => {
    const nextNum = columns.length + 1;
    setColumns([...columns, {
      id: uuidv4(),
      title: `${getTrans("pos.split.orderTitle", "Order")} ${nextNum}`,
      items: []
    }]);
  };

  const removeColumn = (id: string) => {
    if (columns.length <= 1) return;
    const colToRemove = columns.find(c => c.id === id);
    if (!colToRemove) return;
    
    // move its items to the first available column that is not this one
    const targetCol = columns.find(c => c.id !== id);
    if (!targetCol) return;

    setColumns(prev => prev.map(c => {
      if (c.id === targetCol.id) {
        // merge items
        const newItems = [...c.items];
        colToRemove.items.forEach(itemToMove => {
          const key = itemToMove.lineKey || itemToMove.id;
          const existing = newItems.find(x => (x.lineKey || x.id) === key);
          if (existing) {
            existing.cartQty += itemToMove.cartQty;
          } else {
            newItems.push({ ...itemToMove });
          }
        });
        return { ...c, items: newItems };
      }
      return c;
    }).filter(c => c.id !== id));
  };

  const moveItem = (fromColId: string, toColId: string, itemKey: string, qtyToMove: number) => {
    setColumns(prev => {
      const newCols = prev.map(c => ({ ...c, items: c.items.map(i => ({ ...i })) }));
      const fromCol = newCols.find(c => c.id === fromColId);
      const toCol = newCols.find(c => c.id === toColId);
      if (!fromCol || !toCol) return prev;

      const itemIndex = fromCol.items.findIndex(i => (i.lineKey || i.id) === itemKey);
      if (itemIndex === -1) return prev;

      const item = fromCol.items[itemIndex];
      if (item.cartQty < qtyToMove) return prev;

      // Remove from source
      if (item.cartQty === qtyToMove) {
        fromCol.items.splice(itemIndex, 1);
      } else {
        item.cartQty -= qtyToMove;
      }

      // Add to destination
      const destItem = toCol.items.find(i => (i.lineKey || i.id) === itemKey);
      if (destItem) {
        destItem.cartQty += qtyToMove;
      } else {
        toCol.items.push({ ...item, cartQty: qtyToMove });
      }

      return newCols;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.item && data?.colId) {
      setActiveDragItem({ item: data.item, colId: data.colId });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    const activeColId = activeData?.colId;
    // Over can be a column (Droppable) or an item (Sortable)
    const overColId = overData?.colId || overData?.sortable?.containerId || overId.split('::')[0] || overId;

    if (!activeColId || !overColId || activeColId === overColId) return;

    // Moving between columns during drag
    const itemKey = activeId.split('::')[1];
    
    setColumns((prev) => {
      const activeCol = prev.find((c) => c.id === activeColId);
      const overCol = prev.find((c) => c.id === overColId);
      
      if (!activeCol || !overCol) return prev;
      
      const activeItemIndex = activeCol.items.findIndex(i => (i.lineKey || i.id) === itemKey);
      if (activeItemIndex === -1) return prev;

      const itemToMove = activeCol.items[activeItemIndex];

      const newPrev = prev.map(c => ({...c, items: [...c.items]}));
      const newActiveCol = newPrev.find(c => c.id === activeColId)!;
      const newOverCol = newPrev.find(c => c.id === overColId)!;

      newActiveCol.items.splice(activeItemIndex, 1);
      
      const overItemIndex = String(overId).includes('::') 
        ? newOverCol.items.findIndex(i => (i.lineKey || i.id) === String(overId).split('::')[1])
        : newOverCol.items.length;

      const insertIndex = overItemIndex >= 0 ? overItemIndex : newOverCol.items.length;
      newOverCol.items.splice(insertIndex, 0, itemToMove);

      // Update active data to reflect new column
      if (active.data.current) {
        active.data.current.colId = overColId;
      }
      return newPrev;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const activeColId = active.data.current?.colId;
    const overColId = over.data.current?.colId || over.data.current?.sortable?.containerId || overId.split('::')[0] || overId;

    if (activeColId && overColId && activeColId === overColId) {
      // Reorder within same column
      const itemKey = activeId.split('::')[1];
      const overItemKey = overId.split('::')[1];

      setColumns(prev => {
        const col = prev.find(c => c.id === activeColId);
        if (!col) return prev;

        const oldIndex = col.items.findIndex(i => (i.lineKey || i.id) === itemKey);
        const newIndex = col.items.findIndex(i => (i.lineKey || i.id) === overItemKey);

        if (oldIndex === -1 || newIndex === -1) return prev;

        const newCols = [...prev];
        const colIndex = newCols.findIndex(c => c.id === activeColId);
        newCols[colIndex] = {
          ...col,
          items: arrayMove(col.items, oldIndex, newIndex)
        };
        return newCols;
      });
    }
  };

  const handleConfirm = () => {
    // Filter out empty columns
    const validCols = columns.filter(c => c.items.length > 0);
    onConfirm(validCols);
    onOpenChange(false);
  };

  const allItemsAssigned = columns.reduce((sum, col) => sum + col.items.reduce((s, i) => s + i.cartQty, 0), 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full" className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTrans("pos.cart.splitTitle", "Split Bill")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-x-auto overflow-y-hidden bg-muted/20 p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full min-w-max items-start">
              {columns.map((col, idx) => (
                <SortableColumn
                  key={col.id}
                  col={col}
                  idx={idx}
                  columnsLength={columns.length}
                  formatPrice={formatPrice}
                  moveItem={moveItem}
                  setColumns={setColumns}
                  removeColumn={removeColumn}
                  getTrans={getTrans}
                  columns={columns}
                />
              ))}

              <Button 
                variant="outline" 
                className="w-24 h-full border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground shrink-0"
                onClick={addColumn}
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs font-medium text-center">
                  {getTrans("pos.split.addColumn", "Add Order")}
                </span>
              </Button>
            </div>
            
            {typeof document !== "undefined" ? createPortal(
              <DragOverlay zIndex={100000}>
                {activeDragItem ? (
                  <div style={{ width: 296 }} className="opacity-90 shadow-xl bg-muted/30 p-2 rounded-lg border border-border/50 text-sm cursor-grabbing">
                    <div className="font-medium line-clamp-2">{activeDragItem.item.name}</div>
                    <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                      <div>
                        {formatPrice(activeDragItem.item.cartPrice, activeDragItem.item.currency || "USD")} x {activeDragItem.item.cartQty}
                      </div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            ) : null}
          </DndContext>
        </DialogBody>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {getTrans("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!allItemsAssigned}>
            {getTrans("common.confirm", "Confirm Split")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
