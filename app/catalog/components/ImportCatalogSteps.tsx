import { Check } from "@/app/components/ui/icons"
import type { ImportCatalogStep } from "./ImportCatalogState"

const STEPS: { id: ImportCatalogStep; name: string; description: string }[] = [
  { id: "upload", name: "Upload File", description: "Select your CSV or Excel file" },
  { id: "mapping", name: "Map Fields", description: "Match your columns to product fields" },
  { id: "review", name: "Review Data", description: "Check for errors and existing SKUs" },
  { id: "import", name: "Import", description: "Import your products into the catalog" },
]

export function ImportCatalogSteps({ currentStep }: { currentStep: ImportCatalogStep }) {
  const currentIndex = STEPS.findIndex(step => step.id === currentStep)
  return (
    <ol className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Import steps">
      {STEPS.map((step, index) => (
        <li key={step.id} aria-current={currentStep === step.id ? "step" : undefined} className="flex items-center min-w-0">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-inter ${
            index < currentIndex ? "bg-green-500 border-green-500 text-white"
              : index === currentIndex ? "bg-blue-500 border-blue-500 text-white"
                : "bg-gray-100 border-gray-300 text-gray-500"
          }`}>
            {index < currentIndex ? <Check className="h-4 w-4" aria-hidden={true} /> : <span className="text-sm font-medium">{index + 1}</span>}
          </span>
          <div className="ml-3 min-w-0">
            <p className={`text-sm font-medium ${index === currentIndex ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>{step.name}</p>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}