import { useEffect, useState } from "react"
import { SectionCard, SectionCardContent, SectionCardHeader } from "../ui/section-card"

export function PaidThroughNotice({ paidThrough }: { paidThrough: string }) {
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    const end = Date.parse(paidThrough)
    let timer: ReturnType<typeof setTimeout>
    function check() {
      const remaining = end - Date.now()
      if (remaining <= 0) setExpired(true)
      else timer = setTimeout(check, Math.min(remaining, 86_400_000))
    }
    check()
    return () => clearTimeout(timer)
  }, [paidThrough])

  return <SectionCard className="mb-6">
    <SectionCardHeader title="Renewal canceled" />
    <SectionCardContent className="space-y-2 text-sm">
      <p>{expired ? "Your verified paid workspace access ended at " : "Verified paid workspace access through "}<time dateTime={paidThrough} className="font-medium">
        {new Date(paidThrough).toLocaleString("en-US", {
          timeZone: "UTC", timeZoneName: "short",
          year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        })}
      </time>. This payment did not restart your subscription. Automatic renewal is off.</p>
      <p>{expired ? "To continue, go to " : "After that time, return to "}<a className="underline" href="#subscription-plan">Subscription Plan</a> to choose a paid plan and start a new checkout. Nothing is scheduled automatically.</p>
    </SectionCardContent>
  </SectionCard>
}