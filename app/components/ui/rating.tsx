import React from "react";
import { cn } from "@/lib/utils";
import { Star } from "@/app/components/ui/icons";

interface StarRatingProps {
  rating: number | null;
  maxRating?: number;
  onRatingChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
  readonly?: boolean;
}

export function StarRating({
  rating = 0,
  maxRating = 5,
  onRatingChange,
  size = "md",
  color = "text-amber-400",
  className,
  readonly = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  const handleClick = (index: number) => {
    if (!readonly && onRatingChange) {
      const newRating = index === rating ? 0 : index;
      onRatingChange(newRating);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (!readonly) {
      setHoverRating(index);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(null);
    }
  };

  const getStarSize = () => {
    switch (size) {
      case "sm":
        return "h-4 w-4";
      case "lg":
        return "h-7 w-7";
      case "md":
      default:
        return "h-5 w-5";
    }
  };

  const displayRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div 
      className={cn("flex items-center", 
        className?.includes("justify-between") ? "justify-between" : "",
        className
      )}
      onMouseLeave={handleMouseLeave}
    >
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const filled = starValue <= (displayRating || 0);
        return (
          <button
            key={index}
            type="button"
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => handleMouseEnter(starValue)}
            className={cn(
              "transition-opacity",
              filled ? color : "text-gray-300 dark:text-gray-600",
              readonly ? "cursor-default" : "cursor-pointer hover:opacity-80",
              getStarSize(),
              // Remove right margin for last star or justify-between layout
              index === maxRating - 1 || className?.includes("justify-between") 
                ? "" 
                : "mr-2"
            )}
            disabled={readonly}
            aria-label={`Rate ${starValue} out of ${maxRating}`}
          >
            <Star 
              className={cn(
                "h-full w-full fill-current",
                filled ? "text-current" : "text-current"
              )} 
            />
          </button>
        );
      })}
    </div>
  );
} 