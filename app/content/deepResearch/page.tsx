"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import { 
  Search, 
  Calendar,
  Globe,
  Filter,
  Clock,
  Settings,
  Microscope,
  ChevronDown,
  X,
  Plus
} from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { DatePickerWithRange } from "@/app/components/ui/date-range-picker"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { addDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import { toast } from "sonner"

// Time range presets for search filtering

// Time range presets
const TIME_RANGES = [
  { id: 'last24h', name: 'Last 24 hours', days: 1 },
  { id: 'lastWeek', name: 'Last week', days: 7 },
  { id: 'lastMonth', name: 'Last month', days: 30 },
  { id: 'last3Months', name: 'Last 3 months', days: 90 },
  { id: 'lastYear', name: 'Last year', days: 365 },
  { id: 'custom', name: 'Custom range', days: null },
]

interface SearchFilters {
  sources: string[] // Array of URLs only
  dateRange: DateRange | undefined
  timeRange: string
  region: string
  language: string
}

export default function DeepResearchPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [filters, setFilters] = useState<SearchFilters>({
    sources: [], // Start with empty array of URLs
    dateRange: undefined,
    timeRange: 'lastMonth',
    region: 'global',
    language: 'en'
  })
  
  const [newSourceUrl, setNewSourceUrl] = useState("")

  // Set the page title when component mounts
  useEffect(() => {
    // Update the page title for the browser tab
    document.title = 'Deep Research | Market Fit'
    
    // Emit a custom event to update the breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: 'Deep Research',
        path: '/content/deepResearch',
        section: 'content'
      }
    })
    
    // Ensure event is dispatched after DOM is updated
    setTimeout(() => {
      window.dispatchEvent(event)
      console.log('Breadcrumb update event dispatched for Deep Research')
    }, 0)
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Content | Market Fit'
    }
  }, [])

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
          relevance: 95
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
        toast.success("Source added successfully")
      } catch (error) {
        // Show user-friendly error message
        toast.error("Please enter a valid URL (e.g., example.com or https://example.com)")
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
      {/* Sticky Header */}
      <StickyHeader>
        {/* Header content can be left empty as title is handled automatically */}
      </StickyHeader>

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
                <h1 className="text-4xl font-light text-foreground">Deep Research</h1>
              </div>
              <p className="text-muted-foreground">Advanced search across multiple sources</p>
            </div>

            {/* Main Search Bar */}
            <div className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="What would you like to research?"
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
                      Searching...
                    </>
                  ) : (
                    'Search'
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
                      Sources ({filters.sources.length})
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96" align="center">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Website Sources</h4>
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                          Clear all
                        </Button>
                      </div>
                      
                      {/* Add new source */}
                      <div className="space-y-3">
                        <Input
                          placeholder="Enter website URL (e.g., example.com or reddit.com)"
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
                          Add Source
                        </Button>
                      </div>

                      {/* Sources list */}
                      {filters.sources.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          <h5 className="text-sm font-medium text-muted-foreground">Active Sources:</h5>
                          {filters.sources.map((url, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <span className="text-sm truncate flex-1 mr-2">{url}</span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => removeCustomSource(url)}
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
                          <p className="text-sm text-muted-foreground">No sources added yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Add website URLs to search specific sources</p>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Time Range Filter */}
                <Select value={filters.timeRange} onValueChange={handleTimeRangeChange}>
                  <SelectTrigger className="w-44 rounded-full px-6 py-3 h-12">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_RANGES.map((range) => (
                      <SelectItem key={range.id} value={range.id}>
                        {range.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Region Filter */}
                <Select value={filters.region} onValueChange={(region) => setFilters(prev => ({ ...prev, region }))}>
                  <SelectTrigger className="w-40 rounded-full px-6 py-3 h-12">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="eu">Europe</SelectItem>
                    <SelectItem value="asia">Asia</SelectItem>
                    <SelectItem value="latam">Latin America</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range (only show if custom is selected) */}
            {filters.timeRange === 'custom' && (
              <div className="flex justify-center">
                <DatePickerWithRange
                  date={filters.dateRange}
                  setDate={(dateRange) => setFilters(prev => ({ ...prev, dateRange }))}
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
                  <p className="text-muted-foreground mt-4">Searching across selected sources...</p>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && !isSearching && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <h2 className="text-lg font-medium">Research Results</h2>
                    <Badge variant="outline">
                      {searchResults.length} results found
                    </Badge>
                  </div>
                  
                  <div className="space-y-4">
                    {searchResults.map((result) => (
                      <div key={result.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow bg-card">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h3 className="text-lg font-medium line-clamp-2 text-primary hover:underline">
                              <a href={result.url} target="_blank" rel="noopener noreferrer">
                                {result.title}
                              </a>
                            </h3>
                            <Badge variant="outline" className="ml-4 flex-shrink-0">
                              {result.relevance}% match
                            </Badge>
                          </div>
                          <p className="text-muted-foreground line-clamp-3">{result.description}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {RESEARCH_SOURCES.find(s => s.id === result.source)?.icon}
                              {RESEARCH_SOURCES.find(s => s.id === result.source)?.name}
                            </div>
                            <span>•</span>
                            <span>{format(result.date, 'MMM dd, yyyy')}</span>
                            <span>•</span>
                            <a 
                              href={result.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              View source
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
