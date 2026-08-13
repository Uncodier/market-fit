"use client"

import {
  Bot,
  Calendar,
  Clock,
  Code,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  Palette,
  Settings,
  Sparkles,
  Star,
  Tag,
  Target,
  UploadCloud,
  Users,
} from "@/app/components/ui/icons"
import type { OnboardingTaskIcon } from "./onboarding-tasks"

const ICON_MAP: Record<OnboardingTaskIcon, typeof Code> = {
  code: Code,
  settings: Settings,
  target: Target,
  upload: UploadCloud,
  tag: Tag,
  mail: Mail,
  bot: Bot,
  calendar: Calendar,
  star: Star,
  palette: Palette,
  clock: Clock,
  "credit-card": CreditCard,
  users: Users,
  "file-text": FileText,
  sparkles: Sparkles,
  "external-link": ExternalLink,
  globe: Globe,
}

export function OnboardingTaskIconView({
  name,
  className,
}: {
  name: OnboardingTaskIcon
  className?: string
}) {
  const Icon = ICON_MAP[name]
  return <Icon className={className} />
}
