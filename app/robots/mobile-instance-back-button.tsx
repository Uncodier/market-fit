import { Button } from "@/app/components/ui/button"
import { ArrowLeft } from "@/app/components/ui/icons"

export function MobileInstanceBackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="mr-2 shrink-0 rounded-full md:!hidden"
      aria-label="Back to instances"
      title="Back to instances"
      onClick={onBack}
    >
      <ArrowLeft size={20} aria-hidden={true} />
    </Button>
  )
}