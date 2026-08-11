/** Calendly-style peek transforms from /book, generalized for N cards. */

export function getVisitCardMotion(index: number, activeIndex: number) {
  const offset = index - activeIndex

  if (offset === 0) {
    return { transform: "translateX(0) scale(1)", opacity: 1, zIndex: 40 }
  }
  if (offset === 1) {
    return {
      transform: "translateX(calc(100% + 2rem)) scale(0.95)",
      opacity: 0.2,
      zIndex: 30,
    }
  }
  if (offset === -1) {
    return {
      transform: "translateX(calc(-100% - 360px)) scale(0.95)",
      opacity: 0.3,
      zIndex: 30,
    }
  }
  if (offset === 2) {
    return {
      transform: "translateX(calc(200% + 4rem)) scale(0.9)",
      opacity: 0,
      zIndex: 20,
    }
  }
  if (offset === -2) {
    return {
      transform: "translateX(calc(-100% - 640px)) scale(0.9)",
      opacity: 0,
      zIndex: 20,
    }
  }
  if (offset > 0) {
    return {
      transform: `translateX(calc(${offset * 100}% + ${offset * 2}rem)) scale(0.85)`,
      opacity: 0,
      zIndex: 10,
    }
  }
  return {
    transform: `translateX(calc(-100% - ${280 + Math.abs(offset) * 360}px)) scale(0.85)`,
    opacity: 0,
    zIndex: 10,
  }
}
