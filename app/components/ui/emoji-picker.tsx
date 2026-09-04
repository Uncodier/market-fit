"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"
import { ScrollArea } from "./scroll-area"
import { cn } from "@/lib/utils"

const EMOJI_CATEGORIES = [
  {
    name: "Objects & Work",
    emojis: ["📁", "📄", "📋", "📊", "💼", "🏢", "👥", "👤", "🛠️", "⚙️", "📦", "🛒", "💰", "💳", "🧾", "🚀", "📱", "💻", "💡", "📅", "✅", "❌", "⏳"]
  },
  {
    name: "Communication",
    emojis: ["💬", "📧", "📞", "🔔", "📢", "📣", "📝", "✍️", "📫", "💌"]
  },
  {
    name: "Feedback & Rating",
    emojis: ["⭐", "❤️", "👍", "👎", "🔥", "💯", "🎉", "🏆"]
  },
  {
    name: "Places",
    emojis: ["🏠", "🏥", "🏦", "🏭", "🏫", "🏪", "🌍", "📍", "🗺️"]
  },
  {
    name: "Smileys",
    emojis: ["😀", "😊", "😎", "🤔", "😅", "😂", "🥰", "😍", "🙃", "🤐"]
  }
]

interface EmojiPickerProps {
  value?: string
  onChange: (emoji: string) => void
  disabled?: boolean
  className?: string
  defaultEmoji?: string
}

export function EmojiPicker({
  value,
  onChange,
  disabled = false,
  className,
  defaultEmoji = "📁"
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleSelect = (emoji: string) => {
    onChange(emoji)
    setIsOpen(false)
  }

  const currentEmoji = value && !/[A-Za-z_]/.test(value) ? value : defaultEmoji

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn("h-8 w-8 text-base shrink-0", className)}
          title="Choose category icon"
        >
          {currentEmoji}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3 z-[1000050]" 
        align="start"
        sideOffset={8}
        portal={false}
      >
        <ScrollArea className="h-[250px] w-full pr-3">
          <div className="space-y-4">
            {EMOJI_CATEGORIES.map((category) => (
              <div key={category.name}>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  {category.name}
                </h4>
                <div className="grid grid-cols-6 gap-1">
                  {category.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSelect(emoji)}
                      className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent hover:text-accent-foreground text-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
