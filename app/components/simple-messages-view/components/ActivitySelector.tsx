import React, { useEffect, useRef, useState } from 'react'
import { MessageSquare, Image as ImageIcon, PlayCircle, File, ListTodo, Zap, Smartphone, Monitor } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"

const ACTIVITIES = [
  { id: 'ask', label: 'Ask', Icon: MessageSquare, color: 'text-blue-600' },
  { id: 'plan', label: 'Plan', Icon: ListTodo, color: 'text-purple-600' },
  { id: 'generate-image', label: 'Generate Image', Icon: ImageIcon, color: 'text-green-600' },
  { id: 'generate-video', label: 'Generate Video', Icon: PlayCircle, color: 'text-red-600' },
  { id: 'create-automation', label: 'Create Automation', Icon: Zap, color: 'text-yellow-600' },
  { id: 'create-app', label: 'Create App', Icon: Smartphone, color: 'text-sky-600' },
  { id: 'create-presentation', label: 'Create Presentation', Icon: Monitor, color: 'text-indigo-600' },
  { id: 'create-document', label: 'Create Document', Icon: File, color: 'text-teal-600' },
] as const

interface ActivitySelectorProps {
  selectedActivity: string
  onActivityChange: (activity: string) => void
}

export function ActivitySelector({ selectedActivity, onActivityChange }: ActivitySelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = ACTIVITIES.find((activity) => activity.id === selectedActivity) ?? ACTIVITIES[0]
  const SelectedIcon = selected.Icon

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleDropdownToggle = () => {
    if (!isDropdownOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setDropdownDirection(spaceBelow < 100 ? 'up' : 'down')
    }
    setIsDropdownOpen(!isDropdownOpen)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 hover:bg-secondary/80 transition-all duration-200 px-2 md:px-3 w-auto md:w-40 justify-center md:justify-start"
        onClick={handleDropdownToggle}
        title={selected.label}
      >
        <div className="flex items-center w-full justify-center md:justify-start">
          <div className="flex items-center justify-center safari-icon-fix w-[16.2px] h-[16.2px]">
            <SelectedIcon className={`h-[16.2px] w-[16.2px] shrink-0 ${selected.color}`} />
          </div>
          <div className="hidden md:flex flex-col min-w-0 ml-2">
            <span className="truncate">{selected.label}</span>
          </div>
        </div>
      </Button>

      {isDropdownOpen && (
        <div className={`absolute left-0 bg-background border dark:border-white/5 border-black/5 rounded-md shadow-lg z-50 w-40 ${
          dropdownDirection === 'up'
            ? 'bottom-full mb-1'
            : 'top-full mt-1'
        }`}>
          <div className="p-1">
            {ACTIVITIES.map(({ id, label, Icon, color }) => (
              <div
                key={id}
                className="flex items-center hover:bg-accent cursor-pointer rounded-sm px-2 py-1.5"
                onClick={() => {
                  onActivityChange(id)
                  setIsDropdownOpen(false)
                }}
                title={label}
              >
                <div className="flex items-center justify-center safari-icon-fix w-[16.2px] h-[16.2px]">
                  <Icon className={`h-[16.2px] w-[16.2px] shrink-0 ${color}`} />
                </div>
                <div className="flex flex-col min-w-0 ml-2">
                  <span className="truncate">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
