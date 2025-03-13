import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { 
  Users, 
  BarChart, 
  PieChart, 
  HelpCircle, 
  Copy, 
  ExternalLink,
  Globe
} from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { useTheme } from '@/app/context/ThemeContext'
import { Segment, getDisplayValue, chartData } from "../page"

interface SegmentSummaryTabProps {
  segment: Segment
  isActive: boolean
  toggleSegmentStatus: () => Promise<void>
  isUrlModalOpen: boolean
  setIsUrlModalOpen: (open: boolean) => void
  urlInput: string
  setUrlInput: (url: string) => void
  handleSaveUrl: () => Promise<void>
}

export function SegmentSummaryTab({
  segment,
  isActive,
  toggleSegmentStatus,
  isUrlModalOpen,
  setIsUrlModalOpen,
  urlInput,
  setUrlInput,
  handleSaveUrl
}: SegmentSummaryTabProps) {
  const [iframeLoading, setIframeLoading] = useState(false)
  const [copyStates, setCopyStates] = useState({
    keywords: false,
    url: false
  })
  
  const { isDarkMode } = useTheme()

  const copyToClipboard = async (text: string, type: 'keywords' | 'url') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStates(prev => ({
        ...prev,
        [type]: true
      }))
      setTimeout(() => {
        setCopyStates(prev => ({
          ...prev,
          [type]: false
        }))
      }, 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  const handleIframeLoad = () => {
    setIframeLoading(false)
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Audience</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">{getDisplayValue(segment.audience)}</h3>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">
                  <span className="mr-1">+12%</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Size</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">{getDisplayValue(segment.size, 'number')}</h3>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">
                  <span className="mr-1">+8.5%</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Engagement</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">{segment.engagement ? `${segment.engagement}%` : 'N/A'}</h3>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 border-amber-500/20">
                  <span className="mr-1">-2.3%</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Status</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold flex items-center gap-2">
                  <span className={isActive ? "text-green-500" : "text-yellow-500"}>
                    {isActive ? "Active" : "Draft"}
                  </span>
                </h3>
                <Badge 
                  variant={isActive ? "default" : "outline"}
                  className={cn(
                    isActive ? "bg-green-500/20 text-green-600 hover:bg-green-500/20" : "text-amber-600"
                  )}
                >
                  {isActive ? "Active" : "Draft"}
                </Badge>
              </div>
              <div className="flex items-center mt-2 text-xs">
                <span className="text-muted-foreground">Updated {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Conversion Rate</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">{segment?.engagement ? `${segment.engagement}%` : 'N/A'}</h3>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">
                  <span className="mr-1">+5.2%</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Avg. Session Duration</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">3m 42s</h3>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">
                  <span className="mr-1">+18s</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Cost Per Click (CPC)</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">$1.24</h3>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">
                  <span className="mr-1">-$0.12</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Customer LTV</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">$487</h3>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">
                  <span className="mr-1">+$32</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Customer Acquisition Cost (CAC)</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">$52.40</h3>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 border-amber-500/20">
                  <span className="mr-1">+$3.15</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Return on Investment (ROI)</span>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">9.3x</h3>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">
                  <span className="mr-1">+0.4x</span> vs last month
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm h-[350px]">
          <CardHeader className="px-6 pb-2">
            <CardTitle className="text-lg">Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent className="px-6">
            <div className="h-[250px] w-full">
              <div className="h-[250px] w-full">
                <div className="w-full h-full flex flex-col pl-4">
                  {/* Agregar ejes Y con valores */}
                  <div className="flex flex-1 relative">
                    {/* Eje Y con valores */}
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between py-4">
                      <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                        {new Intl.NumberFormat('es-ES').format(Math.max(...chartData.map(item => item.total)))}
                      </div>
                      <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                        {new Intl.NumberFormat('es-ES').format(Math.round(Math.max(...chartData.map(item => item.total)) * 0.75))}
                      </div>
                      <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                        {new Intl.NumberFormat('es-ES').format(Math.round(Math.max(...chartData.map(item => item.total)) * 0.5))}
                      </div>
                      <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                        {new Intl.NumberFormat('es-ES').format(Math.round(Math.max(...chartData.map(item => item.total)) * 0.25))}
                      </div>
                      <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>0</div>
                    </div>

                    {/* Líneas de guía horizontales */}
                    <div className="absolute left-14 right-4 top-0 bottom-0 flex flex-col justify-between pointer-events-none">
                      <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
                      <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
                      <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
                      <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
                      <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
                    </div>

                    {/* Contenedor de barras */}
                    <div className="w-full ml-14 pr-4 h-full flex items-end space-x-1">
                      {chartData.map((item, index) => {
                        // Calculamos la altura relativa basada en el valor máximo
                        const height = Math.max(5, (item.total / Math.max(...chartData.map(item => item.total))) * 100)
                        return (
                          <div 
                            key={index} 
                            className="flex-1 flex flex-col items-center justify-end h-full group relative px-1"
                          >
                            {/* Tooltip mejorado adaptado al tema */}
                            <div 
                              className={`
                                absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 
                                transition-opacity duration-200 rounded-md shadow-md p-2 
                                text-sm z-10 whitespace-nowrap translate-x-[-50%] left-1/2
                                ${isDarkMode ? 
                                  "bg-slate-800 border border-slate-600" : 
                                  "bg-white border border-gray-200"}
                              `}
                              style={{ 
                                boxShadow: isDarkMode 
                                  ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.3)' 
                                  : '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
                              }}
                            >
                              <p className={`font-semibold ${isDarkMode ? "text-slate-100" : "text-gray-900"}`}>{item.name}</p>
                              <p className={isDarkMode ? "text-indigo-300" : "text-indigo-600"}>
                                <span className="font-medium">Total:</span> {new Intl.NumberFormat('es-ES').format(item.total)}
                              </p>
                            </div>
                            
                            {/* Barra con animación al cargar */}
                            <div 
                              className={`
                                w-full transition-all rounded-t-sm origin-bottom
                                ${isDarkMode ? "bg-indigo-400 hover:bg-indigo-300" : "bg-indigo-500 hover:bg-indigo-600"}
                              `}
                              style={{ 
                                height: `${height}%`,
                                animation: `growUp 1s ease-out forwards`,
                                animationDelay: `${index * 0.05}s`
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Eje X con meses */}
                  <div className="h-8 flex ml-14 pr-4 mt-2">
                    {chartData.map((item, index) => (
                      <div key={index} className={`flex-1 text-center text-xs font-medium ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                        {item.name}
                      </div>
                    ))}
                  </div>

                  {/* Estilos para animación */}
                  <style jsx>{`
                    @keyframes growUp {
                      from { transform: scaleY(0); }
                      to { transform: scaleY(1); }
                    }
                  `}</style>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm lg:row-span-2 h-[726px]">
          <CardHeader className="px-6 pb-2">
            <CardTitle>Segment Activity</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-3">
            <div className="space-y-6">
              {/* Sample activity items */}
              <div className="flex items-center">
                <div className="h-9 w-9 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium">JD</span>
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    John Doe
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Updated segment <span className="font-medium">{segment?.name}</span>
                  </p>
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                  {new Date().toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center">
                <div className="h-9 w-9 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium">AS</span>
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Alice Smith
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Created a campaign targeting <span className="font-medium">{segment?.name}</span>
                  </p>
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                  {new Date(Date.now() - 86400000).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center">
                <div className="h-9 w-9 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium">RJ</span>
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Robert Johnson
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Added new keywords to <span className="font-medium">{segment?.name}</span>
                  </p>
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                  {new Date(Date.now() - 172800000).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center">
                <div className="h-9 w-9 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium">EW</span>
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Emma Wilson
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Updated ICP for <span className="font-medium">{segment?.name}</span>
                  </p>
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                  {new Date(Date.now() - 259200000).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center">
                <div className="h-9 w-9 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium">MG</span>
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Michael Green
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Analyzed performance of <span className="font-medium">{segment?.name}</span>
                  </p>
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                  {new Date(Date.now() - 345600000).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center">
                <div className="h-9 w-9 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium">SL</span>
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Sarah Lee
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Created content for <span className="font-medium">{segment?.name}</span>
                  </p>
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                  {new Date(Date.now() - 432000000).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-2 border-none shadow-sm h-[350px]">
          <CardHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Segment Overview</CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => segment.url ? copyToClipboard(segment.url, 'url') : null}
                  className="flex items-center justify-center relative"
                  disabled={!segment.url || copyStates.url}
                >
                  <div className="flex items-center justify-center min-w-0">
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    <span>
                      {copyStates.url ? "Copied!" : "Copy URL"}
                    </span>
                  </div>
                </Button>
                {segment.url ? (
                  <Button 
                    variant="outline" 
                    size="icon"
                    asChild
                  >
                    <a href={segment.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsUrlModalOpen(true)}
                  >
                    Configure URL
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 space-y-4">
            <div className="mt-1">
              <div className="w-full h-[230px] bg-background rounded-md border border-border">
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground/20"></div>
                  </div>
                )}
                {segment.url ? (
                  <div className="relative w-full h-[230px] overflow-hidden flex items-center justify-center">
                    <iframe
                      src={segment.url}
                      className="absolute w-[180%] h-[180%] origin-center rounded-md"
                      style={{ transform: 'scale(0.55)', transformOrigin: 'center' }}
                      onLoad={handleIframeLoad}
                      sandbox="allow-same-origin allow-scripts"
                      loading="lazy"
                      allow="fullscreen"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full space-y-4 p-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Globe className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="font-semibold text-base">No URL Available</h3>
                      <p className="text-xs text-muted-foreground max-w-md">
                        This segment doesn't have a URL configured yet.
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => setIsUrlModalOpen(true)}
                      className="mt-1 h-8 text-xs"
                    >
                      Configure URL
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
} 