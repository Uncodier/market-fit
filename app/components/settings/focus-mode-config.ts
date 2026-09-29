export const getFocusModeConfig = (focusMode: number) => {
  // Strong sales focus (0-25)
  if (focusMode <= 25) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-blue-700",
      label: "Full Sales Focus",
      description: "Agents will strongly prioritize conversion and upselling opportunities.",
      features: [
        "Agents proactively suggest premium plans at every opportunity",
        "Responses heavily emphasize value proposition and ROI",
        "Examples exclusively demonstrate premium features",
        "High-value customer queries are given top priority",
        "Messaging includes strong calls-to-action for upgrades"
      ],
      sliderClass: "bg-blue-700"
    }
  }
  
  // Moderate sales focus (26-40)
  if (focusMode <= 40) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-blue-600",
      label: "Sales Priority",
      description: "Agents will prioritize conversion opportunities while still providing good support.",
      features: [
        "Agents regularly suggest premium plans when relevant",
        "Responses emphasize value proposition and business benefits",
        "Most examples demonstrate premium features",
        "High-value customer queries are prioritized",
        "Messaging includes clear calls-to-action for upgrades"
      ],
      sliderClass: "bg-blue-600"
    }
  }
  
  // Slightly sales leaning (41-49)
  if (focusMode <= 49) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-blue-500",
      label: "Sales Leaning",
      description: "Agents will balance support with a slight emphasis on sales opportunities.",
      features: [
        "Agents suggest premium plans in relevant contexts",
        "Responses mention value proposition alongside useful information",
        "Examples highlight both free and premium features, with emphasis on premium",
        "All user queries get attention, with slight priority to high-value customers",
        "Messaging includes subtle calls-to-action for upgrades"
      ],
      sliderClass: "bg-blue-500"
    }
  }
  
  // Perfect balance (50)
  if (focusMode == 50) {
    return {
      opacity: 0.5,
      color: "text-purple-600",
      label: "Perfect Balance",
      description: "Agents will maintain a perfect equilibrium between support, education and commercial opportunities.",
      features: [
        "Agents perfectly balance helpfulness and business objectives",
        "Responses give exactly equal weight to educational and commercial content",
        "Examples show balanced use cases for all user tiers",
        "All users receive identical priority and attention",
        "Messaging combines educational value with subtle commercial elements"
      ],
      sliderClass: "bg-purple-600"
    }
  }
  
  // Slightly growth leaning (51-60)
  if (focusMode <= 60) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-purple-500",
      label: "Growth Leaning",
      description: "Agents will balance commercial goals with a slight emphasis on user growth.",
      features: [
        "Agents prioritize helpfulness with occasional commercial mentions",
        "Responses focus more on educational content than business objectives",
        "Examples primarily show basic features with some premium mentions",
        "New users get slightly more attention than established ones",
        "Messaging focuses on education with minimal commercial elements"
      ],
      sliderClass: "bg-purple-500"
    }
  }
  
  // Moderate growth focus (61-75)
  if (focusMode <= 75) {
    return {
      opacity: Math.max(0.1, focusMode / 100),
      color: "text-green-600",
      label: "Growth Priority",
      description: "Agents will emphasize user growth and education with minimal sales pressure.",
      features: [
        "Agents focus primarily on user satisfaction and education",
        "Responses provide in-depth guidance with minimal sales mentions",
        "Examples highlight mostly free features with few premium mentions",
        "New user onboarding is given high priority",
        "Messaging centered on user success more than commercial outcomes"
      ],
      sliderClass: "bg-green-600"
    }
  }
  
  // Strong growth focus (76-100)
  return {
    opacity: Math.max(0.1, focusMode / 100),
    color: "text-green-700",
    label: "Full Growth Focus",
    description: "Agents will exclusively focus on user satisfaction, growth and education without any sales pressure.",
    features: [
      "Agents focus exclusively on user education and satisfaction",
      "Responses provide comprehensive guidance with no sales pressure",
      "Examples only demonstrate free features and community benefits",
      "New user onboarding is the top priority",
      "Messaging completely centered on long-term user success"
    ],
    sliderClass: "bg-green-700"
  }
} 