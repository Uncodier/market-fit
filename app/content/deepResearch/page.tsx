"use client"

import { useState, useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import { 
  Search, 
  Calendar,
  Globe,
  Settings,
  Microscope,
  ChevronDown,
  X,
  Plus
} from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { addDays, format } from "date-fns"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"
import { toast } from "sonner"

// Time range presets
const TIME_RANGES = [
  { id: 'last24h', labelKey: 'content.deepResearch.timeRanges.last24h', days: 1 },
  { id: 'lastWeek', labelKey: 'content.deepResearch.timeRanges.lastWeek', days: 7 },
  { id: 'lastMonth', labelKey: 'content.deepResearch.timeRanges.lastMonth', days: 30 },
  { id: 'last3Months', labelKey: 'content.deepResearch.timeRanges.last3Months', days: 90 },
  { id: 'lastYear', labelKey: 'content.deepResearch.timeRanges.lastYear', days: 365 },
  { id: 'custom', labelKey: 'content.deepResearch.timeRanges.custom', days: null },
]

interface ResearchResult {
  id: number
  title: string
  description: string
  source: string
  url: string
  date: Date
  relevance: number
  isSample?: boolean
}

interface SearchFilters {
  sources: string[] // Array of URLs only
  dateRange: { from?: Date; to?: Date } | undefined
  timeRange: string
  region: string
  language: string
}

export default function DeepResearchPage() {
  const { t, locale } = useLocalization()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ResearchResult[]>([])
  const [filters, setFilters] = useState<SearchFilters>({
    sources: [], // Start with empty array of URLs
    dateRange: undefined,
    timeRange: 'lastMonth',
    region: 'global',
    language: 'en'
  })
  
  const [newSourceUrl, setNewSourceUrl] = useState("")

  // Keep the browser title and breadcrumb in sync with the display language.
  useEffect(() => {
    // Update the page title for the browser tab
    document.title = t('content.deepResearch.browserTitle')
    
    // Emit a custom event to update the breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('content.deepResearch.title'),
        path: '/content/deepResearch',
        section: 'content'
      }
    })
    
    // Ensure event is dispatched after DOM is updated
    const timeout = setTimeout(() => {
      window.dispatchEvent(event)
      console.log('Breadcrumb update event dispatched for Deep Research')
    }, 0)
    
    // Cleanup when component unmounts
    return () => {
      clearTimeout(timeout)
      document.title = t('content.deepResearch.contentBrowserTitle')
    }
  }, [t])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
      // TODO: Implement actual search functionality
      console.log('Searching:', searchQuery, filters)
      
      // Mock search delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock results
      setSearchResults([
        {
          id: 1,
          title: "Sample Research Result",
          description: "This is a sample description of research results that would appear here...",
          source: "web",
          url: "https://example.com",
          date: new Date(),
          relevance: 95,
          isSample: true
        }
      ])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleTimeRangeChange = (timeRange: string) => {
    setFilters(prev => {
      const range = TIME_RANGES.find(r => r.id === timeRange)
      let newDateRange = prev.dateRange
      
      if (range && range.days) {
        const end = new Date()
        const start = addDays(end, -range.days)
        newDateRange = { from: start, to: end }
      }
      
      return {
        ...prev,
        timeRange,
        dateRange: newDateRange
      }
    })
  }

  const clearFilters = () => {
    setFilters({
      sources: [],
      dateRange: undefined,
      timeRange: 'lastMonth',
      region: 'global',
      language: 'en'
    })
  }

  const addCustomSource = () => {
    if (newSourceUrl.trim()) {
      let urlToAdd = newSourceUrl.trim()
      
      // Add https:// if no protocol is provided
      if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
        urlToAdd = 'https://' + urlToAdd
      }
      
      // Basic URL validation
      try {
        new URL(urlToAdd)
        setFilters(prev => ({
          ...prev,
          sources: [...prev.sources, urlToAdd]
        }))
        setNewSourceUrl("")
        toast.success(t("content.deepResearch.sourceAdded"))
      } catch {
        // Show user-friendly error message
        toast.error(t("content.deepResearch.invalidSourceUrl"))
      }
    }
  }

  const removeCustomSource = (urlToRemove: string) => {
    setFilters(prev => ({
      ...prev,
      sources: prev.sources.filter(url => url !== urlToRemove)
    }))
  }

  return (
    <div className="h-full flex flex-col">
      <StickyHeader>{null}</StickyHeader>


      {/* Main Content - Search Centered */}
      <div className="flex-1 flex flex-col">
        {/* Search Section - Centered like Google */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl space-y-8">
            {/* Logo/Title Area */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Microscope className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-4xl font-light text-foreground">{t("content.deepResearch.title")}</h1>
              </div>
              <p className="text-muted-foreground">{t("content.deepResearch.description")}</p>
            </div>

            {/* Main Search Bar */}
            <div className="space-y-4">
              <div className="relative">
                <Input
                  placeholder={t("content.deepResearch.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full h-14 text-lg pl-12 pr-4 rounded-full border-2 border-border/50 focus:border-primary/50 shadow-sm hover:shadow-md transition-all"
                />
                <Search className="h-5 w-5 text-muted-foreground absolute left-4 top-1/2 transform -translate-y-1/2" />
              </div>

              {/* Search Button */}
              <div className="flex justify-center">
                <Button 
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || isSearching}
                  className="px-8 py-3 rounded-full"
                  size="lg"
                >
                  {isSearching ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t("content.deepResearch.searching")}
                    </>
                  ) : (
                    t('content.deepResearch.search')
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex justify-center">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Sources Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="default" className="rounded-full gap-2 px-6 py-3">
                      <Settings className="h-5 w-5" />
                      {t("content.deepResearch.sourcesCount", { count: filters.sources.length })}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96" align="center">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{t("content.deepResearch.websiteSources")}</h4>
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                          {t("content.deepResearch.clearAll")}
                        </Button>
                      </div>
                      
                      {/* Add new source */}
                      <div className="space-y-3">
                        <Input
                          placeholder={t("content.deepResearch.sourceUrlPlaceholder")}
                          value={newSourceUrl}
                          onChange={(e) => setNewSourceUrl(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addCustomSource()}
                          className="w-full"
                        />
                        <Button 
                          size="default" 
                          onClick={addCustomSource}
                          disabled={!newSourceUrl.trim()}
                          className="w-full gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          {t("content.deepResearch.addSource")}
                        </Button>
                      </div>

                      {/* Sources list */}
                      {filters.sources.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          <h5 className="text-sm font-medium text-muted-foreground">{t("content.deepResearch.activeSources")}</h5>
                          {filters.sources.map((url, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <span className="text-sm truncate flex-1 mr-2">{url}</span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => removeCustomSource(url)}
                                aria-label={t("content.deepResearch.removeSource", { url })}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {filters.sources.length === 0 && (
                        <div className="text-center py-6">
                          <p className="text-sm text-muted-foreground">{t("content.deepResearch.noSources")}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t("content.deepResearch.noSourcesDescription")}</p>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Time Range Filter */}
                <Select value={filters.timeRange} onValueChange={handleTimeRangeChange}>
                  <SelectTrigger className="w-44 rounded-full px-5 py-2.5 h-11" aria-label={t("content.deepResearch.timeRange")}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_RANGES.map((range) => (
                      <SelectItem key={range.id} value={range.id}>
                        {t(range.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Region Filter */}
                <Select value={filters.region} onValueChange={(region) => setFilters(prev => ({ ...prev, region }))}>
                  <SelectTrigger className="w-40 rounded-full px-6 py-3 h-12" aria-label={t("content.deepResearch.region")}>
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">{t("content.deepResearch.regions.global")}</SelectItem>
                    <SelectItem value="us">{t("content.deepResearch.regions.us")}</SelectItem>
                    <SelectItem value="eu">{t("content.deepResearch.regions.eu")}</SelectItem>
                    <SelectItem value="asia">{t("content.deepResearch.regions.asia")}</SelectItem>
                    <SelectItem value="latam">{t("content.deepResearch.regions.latam")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range (only show if custom is selected) */}
            {filters.timeRange === 'custom' && (
              <div className="flex justify-center">
                <CalendarDateRangePicker
                  initialStartDate={filters.dateRange?.from}
                  initialEndDate={filters.dateRange?.to}
                  onRangeChange={(startDate, endDate) => 
                    setFilters(prev => ({ ...prev, dateRange: { from: startDate, to: endDate } }))
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Results Section - Only show when searching or have results */}
        {(isSearching || searchResults.length > 0) && (
          <div className="px-4 pb-8">
            <div className="max-w-4xl mx-auto">
              {/* Loading State */}
              {isSearching && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-4">{t("content.deepResearch.searchingSources")}</p>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && !isSearching && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <h2 className="text-lg font-medium">{t("content.deepResearch.resultsTitle")}</h2>
                    <Badge variant="outline">
                      {t("content.deepResearch.resultsCount", { count: searchResults.length })}
                    </Badge>
                  </div>
                  
                  <div className="space-y-4">
                    {searchResults.map((result) => (
                      <div key={result.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow bg-card">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h3 className="text-lg font-medium line-clamp-2 text-primary hover:underline">
                              <a href={result.url} target="_blank" rel="noopener noreferrer">
                                {result.isSample ? t("content.deepResearch.sampleTitle") : result.title}
                              </a>
                            </h3>
                            <Badge variant="outline" className="ml-4 flex-shrink-0">
                              {t("content.deepResearch.relevance", { relevance: result.relevance })}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground line-clamp-3">{result.isSample ? t("content.deepResearch.sampleDescription") : result.description}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Globe className="h-4 w-4" />
                              {result.source === "web" ? t("content.deepResearch.webSource") : result.source}
                            </div>
                            <span>•</span>
                            <span>{format(result.date, 'MMM dd, yyyy', { locale: getDateFnsLocale(locale) })}</span>
                            <span>•</span>
                            <a 
                              href={result.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {t("content.deepResearch.viewSource")}
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
