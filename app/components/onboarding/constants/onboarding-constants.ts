export const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" }
]

export const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "entertainment", label: "Entertainment" },
  { value: "food", label: "Food & Beverage" },
  { value: "travel", label: "Travel & Hospitality" },
  { value: "real_estate", label: "Real Estate" },
  { value: "professional_services", label: "Professional Services" },
  { value: "other", label: "Other" }
]

export const TIMEZONES = [
  { value: "America/Mexico_City", label: "Mexico City (GMT-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
  { value: "America/Chicago", label: "Chicago (GMT-6)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "America/Toronto", label: "Toronto (GMT-5)" },
  { value: "America/Vancouver", label: "Vancouver (GMT-8)" },
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "Europe/London", label: "London (GMT+0)" },
  { value: "Europe/Paris", label: "Paris (GMT+1)" },
  { value: "Europe/Madrid", label: "Madrid (GMT+1)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+1)" },
  { value: "Europe/Moscow", label: "Moscow (GMT+3)" },
  { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
  { value: "Asia/Mumbai", label: "Mumbai (GMT+5:30)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (GMT+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+9)" },
  { value: "Asia/Shanghai", label: "Shanghai (GMT+8)" },
  { value: "Australia/Sydney", label: "Sydney (GMT+11)" },
  { value: "Pacific/Auckland", label: "Auckland (GMT+13)" }
]

export const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" }
]

export const TIME_OPTIONS = (() => {
  const times = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      times.push({ value: time, label: time })
    }
  }
  return times
})()

export const steps = [
  {
    id: 1,
    title: "Basic Information",
    description: "Name, URL & logo"
  },
  {
    id: 2,
    title: "AI Focus Mode",
    description: "Sales vs Growth balance"
  },
  {
    id: 3,
    title: "Business Hours",
    description: "Schedules & timezones"
  },
  {
    id: 4,
    title: "Locations",
    description: "Physical presence"
  },
  {
    id: 5,
    title: "Company Information",
    description: "About, goals & SWOT"
  },
  {
    id: 6,
    title: "Marketing",
    description: "Budget & channels"
  },
  {
    id: 7,
    title: "Products & Services",
    description: "Offerings & pricing"
  },
  {
    id: 8,
    title: "Next Steps",
    description: "Ready to go!"
  }
] 