/** Procurement detail geometry with a reading column and sticky participation rail. */
export const tenderDetailClasses = {
  main: 'flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10',
  grid: 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem] gap-8 lg:gap-10 items-start',
  summary: 'min-w-0 flex flex-col lg:sticky lg:top-28',
  sectionTitle: 'text-xl sm:text-2xl font-bold mb-4 sm:mb-6',
  requirements: 'border rounded-2xl sm:rounded-[2rem] overflow-hidden bg-card',
  requirement: 'p-4 sm:p-6 border-b last:border-0 hover:bg-muted/30 transition-colors break-words',
  actionPanel: 'p-6 sm:p-8 bg-card border border-border/50 rounded-3xl shadow-2xl shadow-black/5 relative overflow-hidden',
} as const