import React, { useEffect } from "react"

interface AnimatedConnectionLineProps {
  className?: string
  direction?: "down" | "up" | "right" | "left"
  dotColor?: string
  speed?: "slow" | "normal" | "fast" 
}

export function AnimatedConnectionLine({ 
  className,
  direction = "down",
  dotColor = "var(--primary)",
  speed = "normal"
}: AnimatedConnectionLineProps) {
  // Determine animation duration based on speed
  const getDuration = () => {
    switch(speed) {
      case "slow": return "3s";
      case "fast": return "1.2s";
      default: return "2s";
    }
  };

  // Apply CSS animation directly using keyframes
  useEffect(() => {
    const animationName = `flow-${direction}`;
    
    // Only add the keyframes once to prevent duplicates
    if (!document.getElementById(`keyframes-${animationName}`)) {
      const isVertical = direction === "down" || direction === "up";
      const startPosition = direction === "down" || direction === "right" ? "0%" : "100%";
      const endPosition = direction === "down" || direction === "right" ? "100%" : "0%";
      
      const style = document.createElement('style');
      style.id = `keyframes-${animationName}`;
      
      style.innerHTML = `
        @keyframes ${animationName} {
          0% {
            ${isVertical ? `top: ${startPosition}` : `left: ${startPosition}`};
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          85% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            ${isVertical ? `top: ${endPosition}` : `left: ${endPosition}`};
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
        }
      `;
      
      document.head.appendChild(style);
    }

    // Clean up keyframes style on unmount
    return () => {
      const existingStyle = document.getElementById(`keyframes-${animationName}`);
      if (existingStyle && document.querySelectorAll(`[data-animation="${animationName}"]`).length <= 1) {
        existingStyle.remove();
      }
    };
  }, [direction]);

  // Determine positioning styles based on direction
  const containerStyles = (): React.CSSProperties => {
    const isVertical = direction === "down" || direction === "up";
    return {
      position: "absolute",
      width: isVertical ? "24px" : "100%", // Even wider to ensure dots are visible
      height: isVertical ? "100%" : "24px", // Even taller to ensure dots are visible
      pointerEvents: "none", // Allow clicking through the container
      zIndex: 10, // Ensure it appears above the border line
      ...(isVertical ? { left: "calc(50% - 12px)" } : { top: "calc(50% - 12px)" }),
    };
  };

  // Generate dots with different delays
  const generateDots = () => {
    const dots = [];
    const isVertical = direction === "down" || direction === "up";
    
    // Adjust number of dots based on direction (more for horizontal lines)
    const numDots = isVertical ? 3 : 4;
    
    for (let i = 0; i < numDots; i++) {
      const delay = `${i * 0.7}s`;
      
      // Each dot has its own animation with offset
      const dotStyle: React.CSSProperties = {
        position: "absolute",
        width: "10px", // Even larger dots
        height: "10px", // Even larger dots
        borderRadius: "50%",
        backgroundColor: dotColor,
        boxShadow: `0 0 8px 3px ${dotColor}`, // Enhanced glow effect
        animation: `flow-${direction} ${getDuration()} infinite`,
        animationDelay: delay,
        // Position at starting point (will be animated by keyframes)
        left: isVertical ? "50%" : "0%",
        top: isVertical ? "0%" : "50%",
        zIndex: 20, // Ensure dots appear above everything
      };
      
      dots.push(<div key={i} style={dotStyle} />);
    }
    
    return dots;
  };

  return (
    <div className={className} style={containerStyles()} data-animation={`flow-${direction}`}>
      {generateDots()}
    </div>
  );
} 