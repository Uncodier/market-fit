"use client"

import {
  Archive,
  FolderOpen,
  Loader,
  MoreVertical,
  Pencil,
  Trash2,
} from "@/app/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface InstanceTabMenuProps {
  instanceName: string
  isDeleting: boolean
  canRename?: boolean
  onOpen: () => void
  onRename: () => void
  onArchive: () => void
  onDelete: () => void
}

export function InstanceTabMenu({
  instanceName,
  isDeleting,
  canRename = true,
  onOpen,
  onRename,
  onArchive,
  onDelete,
}: InstanceTabMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          role="button"
          tabIndex={isDeleting ? -1 : 0}
          aria-label={`Actions for ${instanceName}`}
          aria-disabled={isDeleting}
          title={isDeleting ? "Deleting..." : "Instance actions"}
          onClick={(event) => {
            event.stopPropagation()
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onFocus={(event) => event.stopPropagation()}
          className={cn(
            "ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
            isDeleting
              ? "cursor-default opacity-100"
              : "cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {isDeleting ? (
            <Loader className="h-3 w-3 text-destructive" size={12} />
          ) : (
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation()
            onOpen()
          }}
          className="cursor-pointer"
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canRename}
          onSelect={(event) => {
            event.stopPropagation()
            onRename()
          }}
          className="cursor-pointer"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation()
            onArchive()
          }}
          className="cursor-pointer"
        >
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isDeleting}
          onSelect={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
