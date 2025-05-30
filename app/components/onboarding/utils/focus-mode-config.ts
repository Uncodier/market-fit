export const getFocusModeConfig = (value: number) => {
  if (value <= 20) {
    return {
      label: "Revenue Maximizer",
      description: "Agents will aggressively pursue sales opportunities and conversions, prioritizing immediate revenue.",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    }
  }
  if (value <= 40) {
    return {
      label: "Sales Focus",
      description: "Agents will prioritize conversion opportunities while still providing quality support.",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    }
  }
  if (value <= 49) {
    return {
      label: "Balanced (Sales Leaning)",
      description: "Agents will balance support with strategic sales opportunities, with a slight focus on conversions.",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200"
    }
  }
  if (value === 50) {
    return {
      label: "Perfect Balance",
      description: "Agents will maintain an ideal equilibrium between support, education and commercial opportunities.",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200"
    }
  }
  if (value <= 60) {
    return {
      label: "Balanced (Growth Leaning)",
      description: "Agents will focus on helpful support with user growth in mind, with minimal sales emphasis.",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200"
    }
  }
  if (value <= 80) {
    return {
      label: "Growth Focus",
      description: "Agents will emphasize user acquisition and retention, with educational content and engagement.",
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    }
  }
  return {
    label: "Growth Maximizer",
    description: "Agents will exclusively focus on user experience, education, and community building.",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200"
  }
} 