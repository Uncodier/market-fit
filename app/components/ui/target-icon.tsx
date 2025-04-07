import React from "react";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  onClick?: () => void;
  "aria-hidden"?: boolean;
}

const IconWrapper = ({ 
  children, 
  className = "", 
  size = 20, 
  style = {}, 
  onClick,
  "aria-hidden": ariaHidden = true
}: IconProps & { children: React.ReactNode }) => {
  return (
    <span 
      className={cn("inline-flex", className)}
      style={{ 
        width: size, 
        height: size, 
        ...style 
      }}
      onClick={onClick}
      aria-hidden={ariaHidden}
    >
      {children}
    </span>
  );
};

// Target (Bullseye/Crosshair)
export const Target = ({ className = "", size = 20, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  </IconWrapper>
) 