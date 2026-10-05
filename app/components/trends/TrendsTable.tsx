"use client"

import { useState } from "react"
import { Badge } from "@/app/components/ui/badge"
import { Pagination } from "@/app/components/ui/pagination"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { TrendingUp, TrendingDown, Sparkles, Clock } from "@/app/components/ui/icons"
import type { TrendItem } from "@/app/types/trends"
import { cleanHtmlContent } from "./trends-presentation"

function TrendTableRow({ trend, onTrendClick }: { trend: TrendItem; onTrendClick: (trend: TrendItem) => void }) {
  const score = !trend.score ? 'N/A' : trend.score >= 1000 ? `${(trend.score / 1000).toFixed(1)}K` : trend.score.toString()
  const changeData = trend.change === undefined || trend.change === null ? null : {
    value: Math.abs(trend.change).toFixed(1),
    isPositive: trend.change >= 0,
    color: trend.change >= 0 ? 'text-green-600' : 'text-red-600'
  }
  return (
    <TableRow
      className="group hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => onTrendClick(trend)}
    >
      <TableCell>
        <div className="space-y-0.5">
          <p className="font-medium text-sm line-clamp-2" title={cleanHtmlContent(trend.title)}>{cleanHtmlContent(trend.title)}</p>
          {trend.description && (
            <p className="text-xs text-muted-foreground line-clamp-1" title={cleanHtmlContent(trend.description)}>{cleanHtmlContent(trend.description)}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="text-xs capitalize"
        >
          {trend.platform}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">
        {score}
      </TableCell>
      <TableCell>
        {changeData && (
          <div className={`flex items-center gap-1 ${changeData.color}`}>
            {changeData.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span className="text-xs font-medium">{changeData.value}%</span>
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {/* Show matched keywords first */}
          {trend.matchedKeywords?.slice(0, 2).map((keyword, index) => {
            const keywordText = keyword.includes(':') ? keyword.split(':')[1] : keyword
            const isCommercial = keyword.includes('pain:') || keyword.includes('goal:') || keyword.includes('commercial:')
            return (
              <Badge
                key={`keyword-${index}`}
                variant={isCommercial ? "default" : "outline"}
                className={`text-xs px-1.5 py-0.5 ${isCommercial ? 'bg-green-100 text-green-800 border-green-200' : ''}`}
              >
                {keywordText.length > 10 ? `${keywordText.substring(0, 10)}...` : keywordText}
              </Badge>
            )
          })}

          {/* Show tags as fallback if no matched keywords or to fill remaining space */}
          {((trend.matchedKeywords?.length || 0) < 2) && trend.tags?.slice(0, 3 - (trend.matchedKeywords?.length || 0)).map((tag, index) => (
            <Badge
              key={`tag-${index}`}
              variant="secondary"
              className="text-xs px-1.5 py-0.5"
            >
              {tag.length > 10 ? `${tag.substring(0, 10)}...` : tag}
            </Badge>
          ))}

          {/* Show placeholder if no keywords or tags */}
          {(!trend.matchedKeywords || trend.matchedKeywords.length === 0) &&
           (!trend.tags || trend.tags.length === 0) && (
            <span className="text-xs text-muted-foreground">No keywords</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {/* Content Opportunity */}
          {trend.contentOpportunity && trend.contentOpportunity !== 'low' && (
            <div className="flex items-center gap-1">
              <Sparkles className={`h-3 w-3 ${
                trend.contentOpportunity === 'high' ? 'text-purple-600' : 'text-blue-600'
              }`} />
              <span className={`text-xs ${
                trend.contentOpportunity === 'high' ? 'text-purple-600' : 'text-blue-600'
              }`}>
                {trend.contentOpportunity === 'high' ? 'Hot Topic' : 'Good Topic'}
              </span>
            </div>
          )}

          {/* Freshness */}
          {trend.commercialSignals?.some(signal => signal.includes('freshness') || signal.includes('timing')) && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-orange-600" />
              <span className="text-xs text-orange-600">Fresh</span>
            </div>
          )}

          {/* Relevance Score */}
          {trend.relevanceScore && trend.relevanceScore > 50 && (
            <span className={`text-xs ${
              trend.relevanceScore > 100 ? 'text-green-600' :
              trend.relevanceScore > 75 ? 'text-yellow-600' : 'text-gray-600'
            }`}>
              Score: {trend.relevanceScore}
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function TrendsTable({ trends, onTrendClick }: { trends: TrendItem[]; onTrendClick: (trend: TrendItem) => void }) {
  const [page, setPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const totalPages = Math.max(1, Math.ceil(trends.length / itemsPerPage))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTrends = trends.slice(startIndex, endIndex)
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value, 10))
    setPage(1)
  }
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Trend</TableHead>
            <TableHead className="w-[100px]">Platform</TableHead>
            <TableHead className="w-[80px]">Score</TableHead>
            <TableHead className="w-[80px]">Change</TableHead>
            <TableHead className="w-[180px]">Keywords</TableHead>
            <TableHead className="w-[140px]">Opportunity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTrends.map(trend => <TrendTableRow key={trend.id} trend={trend} onTrendClick={onTrendClick} />)}
        </TableBody>
      </Table>
      {trends.length > itemsPerPage && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
              <span className="font-medium">{Math.min(endIndex, trends.length)}</span>{" "}
              of <span className="font-medium">{trends.length}</span> results
            </p>
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="h-8 w-[70px]" aria-label="Trends per page">
                <SelectValue placeholder={itemsPerPage.toString()} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 15, 20].map(value => <SelectItem key={value} value={value.toString()}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </>
  )
}
