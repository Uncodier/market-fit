"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"
import { DocumentListHead, documentListShellClassName } from "@/app/components/documents/document-list"
import { cn } from "@/lib/utils"

function EntitySkeleton({ nameWidth, secondaryWidth }: { nameWidth: string; secondaryWidth: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={cn("h-4 max-w-full", nameWidth)} />
        <Skeleton className={cn("h-3 max-w-full", secondaryWidth)} />
      </div>
    </div>
  )
}

export function LeadsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[920px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-10 px-3">
              <Skeleton className="h-4 w-4" />
            </DocumentListHead>
            <DocumentListHead className="w-[28%]">
              <Skeleton className="h-3 w-16" />
            </DocumentListHead>
            <DocumentListHead className="w-[24%]">
              <Skeleton className="h-3 w-12" />
            </DocumentListHead>
            <DocumentListHead className="w-[12%]">
              <Skeleton className="h-3 w-14" />
            </DocumentListHead>
            <DocumentListHead className="w-[12%]">
              <Skeleton className="h-3 w-16" />
            </DocumentListHead>
            <DocumentListHead className="w-[14%]">
              <Skeleton className="h-3 w-16" />
            </DocumentListHead>
            <DocumentListHead className="w-[8%]" align="right">
              <Skeleton className="ml-auto h-3 w-14" />
            </DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="px-3 py-3.5">
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell className="py-3.5">
                <EntitySkeleton nameWidth="w-32" secondaryWidth="w-20" />
              </TableCell>
              <TableCell className="py-3.5">
                <EntitySkeleton nameWidth="w-28" secondaryWidth="w-36" />
              </TableCell>
              <TableCell className="py-3.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </TableCell>
              <TableCell className="py-3.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </TableCell>
              <TableCell className="py-3.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </TableCell>
              <TableCell className="py-3.5">
                <Skeleton className="ml-auto h-8 w-8 rounded-md" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  )
}
