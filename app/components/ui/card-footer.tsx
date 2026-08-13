"use client"

import * as React from "react"
import { SectionCardFooter } from "@/app/components/ui/section-card"

interface ActionFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function ActionFooter({
  children,
  className,
  ...props
}: ActionFooterProps) {
  return (
    <SectionCardFooter className={className} {...props}>
      {children}
    </SectionCardFooter>
  )
}
