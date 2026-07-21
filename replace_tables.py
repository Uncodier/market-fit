import os
import glob

replacements = {
    "bg-white": "bg-card",
    "bg-gray-50/50": "bg-muted/30",
    "bg-gray-50/30": "bg-muted/30",
    "bg-gray-50": "bg-muted/30",
    "text-gray-900": "text-foreground",
    "text-gray-700": "text-foreground",
    "text-gray-500": "text-muted-foreground",
    "text-gray-400": "text-muted-foreground",
    "text-gray-600": "text-muted-foreground",
    "border-gray-200": "border-border",
    "border-gray-100": "border-border",
    "hover:bg-gray-100": "hover:bg-muted/50",
    "hover:bg-gray-50": "hover:bg-muted/50",
    "bg-gray-100": "bg-muted",
}

files = [
    "app/catalog/page.tsx",
    "app/catalog/components/CatalogTable.tsx",
    "app/catalog/components/CreateCatalogItemDialog.tsx",
    "app/catalog/[id]/page.tsx",
    "app/inventory/page.tsx",
    "app/orders/page.tsx",
    "app/orders/[id]/page.tsx",
    "app/shipments/page.tsx",
    "app/shipments/[id]/page.tsx",
    "app/promotions/page.tsx",
    "app/promotions/[id]/page.tsx",
    "app/price-lists/page.tsx",
    "app/price-lists/[id]/page.tsx"
]

for file in files:
    if os.path.exists(file):
        with open(file, "r") as f:
            content = f.read()
        
        for old, new in replacements.items():
            content = content.replace(old, new)
            
        with open(file, "w") as f:
            f.write(content)
