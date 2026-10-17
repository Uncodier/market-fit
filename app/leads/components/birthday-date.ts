export interface BirthdayDraft {
  day: string
  month: string
  year: string
}

export function getBirthdayDraft(value: string | null): BirthdayDraft {
  const [year = "", month = "", day = ""] = value?.split("T")[0].split("-") || []
  return { day, month, year }
}

export function getBirthdayError({ day, month, year }: BirthdayDraft): string | null {
  if (!day && !month && !year) return null
  if (!day || !month || !year) return "Enter day, month and year."
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return "Enter a valid date with a four-digit year."
  }

  const dayNumber = Number(day), monthNumber = Number(month), yearNumber = Number(year)
  const date = new Date(0)
  // Use UTC calendar parts, not local offsets or the Date constructor's 0–99 year shortcut.
  date.setUTCFullYear(yearNumber, monthNumber - 1, dayNumber)
  if (yearNumber < 1 || date.getUTCFullYear() !== yearNumber ||
      date.getUTCMonth() !== monthNumber - 1 || date.getUTCDate() !== dayNumber) {
    return "Enter a valid date."
  }
  return null
}

export function serializeBirthday(draft: BirthdayDraft): string | null {
  const error = getBirthdayError(draft)
  if (error) throw new Error(error)
  if (!draft.day && !draft.month && !draft.year) return null
  return `${draft.year}-${draft.month.padStart(2, "0")}-${draft.day.padStart(2, "0")}`
}

export function displayBirthday(value: string | null): string {
  const draft = getBirthdayDraft(value)
  if (!value || getBirthdayError(draft)) return value || ""
  return `${draft.day.padStart(2, "0")}/${draft.month.padStart(2, "0")}/${draft.year}`
}