"use client"

import { useState, useRef } from "react"
import { PdpGalleryEntry } from "@/app/lib/image-utils"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"

interface PdpHeroGalleryProps {
  entries: PdpGalleryEntry[]
  itemName: string
}

export function PdpHeroGallery({ entries, itemName }: PdpHeroGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (!scrollRef.current) return
    const index = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth)
    setCurrentIndex(index)
  }

  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({
      left: index * scrollRef.current.clientWidth,
      behavior: "smooth",
    })
  }

  if (entries.length === 0) {
    return (
      <div className="w-full h-full bg-secondary/50" />
    )
  }

  if (entries.length === 1) {
    return (
      <img
        src={entries[0].url}
        alt={itemName}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    )
  }

  return (
    <div className="relative w-full h-full group">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {entries.map((entry, index) => (
          <div key={index} className="relative w-full h-full shrink-0 snap-start">
            <img
              src={entry.url}
              alt={`${itemName} - Image ${index + 1}`}
              fetchPriority={index === 0 ? "high" : "auto"}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
        ))}
      </div>

      {/* Desktop controls */}
      <div className="absolute inset-0 hidden md:flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <button
          onClick={() => scrollToIndex(Math.max(0, currentIndex - 1))}
          className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm shadow-sm flex items-center justify-center pointer-events-auto hover:bg-background transition-colors disabled:opacity-50"
          disabled={currentIndex === 0}
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => scrollToIndex(Math.min(entries.length - 1, currentIndex + 1))}
          className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm shadow-sm flex items-center justify-center pointer-events-auto hover:bg-background transition-colors disabled:opacity-50"
          disabled={currentIndex === entries.length - 1}
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile dots */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 md:hidden pointer-events-none z-10">
        {entries.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              scrollToIndex(index);
            }}
            aria-label={`Go to slide ${index + 1}`}
            className={`pointer-events-auto h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex 
                ? "w-6 bg-white shadow-[0_0_2px_rgba(0,0,0,0.5)]" 
                : "w-2 bg-white/50 hover:bg-white/80 shadow-[0_0_2px_rgba(0,0,0,0.3)]"
            }`}
          />
        ))}
      </div>

      {/* Desktop thumbnails stepper */}
      <div className="absolute bottom-4 left-0 right-0 hidden md:flex justify-center gap-2 px-4 pointer-events-none z-10">
        <div className="flex gap-2 p-1.5 bg-black/30 backdrop-blur-md rounded-xl">
          {entries.map((entry, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                scrollToIndex(index);
              }}
              aria-label={`Go to slide ${index + 1}`}
              className={`pointer-events-auto relative w-12 h-12 rounded-lg overflow-hidden transition-all duration-300 ${
                index === currentIndex 
                  ? "ring-2 ring-white scale-105 opacity-100" 
                  : "opacity-50 hover:opacity-100"
              }`}
            >
              <img
                src={entry.url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
