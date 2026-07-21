import os

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
    "app/pos/page.tsx",
    "app/pos/components/PaymentConfirmationDialog.tsx"
]

for file in files:
    with open(file, "r") as f:
        content = f.read()
    
    # Exceptions: Input/Select background should probably just remove bg-card if it causes issues, but for now we replace. 
    # But wait, in the plan it says: Select/Input `bg-white` | omit override (primitives already theme-aware)
    # Let's handle these specially if possible, or just let them become bg-background or omit.
    # The simplest is replacing "className=\"bg-white\"" in SelectTrigger with "" or "bg-background"
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(file, "w") as f:
        f.write(content)
