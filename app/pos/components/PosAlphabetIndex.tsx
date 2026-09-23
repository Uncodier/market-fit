"use client";

import { useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface PosAlphabetIndexProps {
  letters: string[];
  onSelect: (letter: string) => void;
}

export function PosAlphabetIndex({
  letters,
  onSelect,
}: PosAlphabetIndexProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const selectAtPosition = (clientY: number) => {
    const rail = railRef.current;
    if (!rail || letters.length === 0) return;

    const bounds = rail.getBoundingClientRect();
    const relativePosition = Math.min(
      Math.max(clientY - bounds.top, 0),
      Math.max(bounds.height - 1, 0),
    );
    const index = Math.min(
      Math.floor((relativePosition / bounds.height) * letters.length),
      letters.length - 1,
    );
    const letter = letters[index];
    setActiveLetter(letter);
    onSelect(letter);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    selectAtPosition(event.clientY);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    selectAtPosition(event.clientY);
  };

  return (
    <div className="pointer-events-none fixed bottom-0 right-1 top-[calc(var(--topbar-height,64px)+71px)] z-30 flex items-center md:hidden">
      <div
        ref={railRef}
        role="navigation"
        aria-label="Catalog alphabet index"
        className="pointer-events-auto flex h-[64%] touch-none select-none flex-col justify-around rounded-full border border-border/40 bg-background/55 px-1 py-1.5 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/35"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setActiveLetter(null)}
        onPointerCancel={() => setActiveLetter(null)}
      >
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            tabIndex={-1}
            aria-label={`Jump to items starting with ${letter}`}
            className={cn(
              "flex min-h-2.5 max-h-4 w-3 flex-1 items-center justify-center rounded-full text-[9px] font-semibold leading-none text-primary",
              activeLetter === letter && "bg-primary text-primary-foreground",
            )}
            onClick={() => onSelect(letter)}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
}
