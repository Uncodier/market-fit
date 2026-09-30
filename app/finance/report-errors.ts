export const UNKNOWN_CURRENCY_MESSAGE = 'Historical journal entries have no valid currency. Reconcile their currency before viewing this report.'
export const INVALID_JOURNAL_MESSAGE = 'Historical journal entries are incomplete or unbalanced. Review them before viewing this report.'
export const REPORT_UNAVAILABLE_MESSAGE = 'Could not load the complete report. Totals and balance status are unavailable, not zero.'

export function reportErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return [UNKNOWN_CURRENCY_MESSAGE, INVALID_JOURNAL_MESSAGE].includes(message) ? message : REPORT_UNAVAILABLE_MESSAGE
}