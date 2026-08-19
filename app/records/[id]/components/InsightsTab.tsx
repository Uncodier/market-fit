import React, { useMemo, useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts"
import { Sparkles, FileText, BarChart as ChartIcon, PieChart as PieIcon, Image as ImageIcon, Activity, TrendingUp, Calendar, Clock, Folder } from "@/app/components/ui/icons"
import { getHistoricalRelatedRecords, getRecords } from "../../actions"

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export function InsightsTab({ 
  fields, 
  formData, 
  description,
  record,
  relationsData
}: { 
  fields: any[], 
  formData: Record<string, any>, 
  description?: string,
  record?: any,
  relationsData?: Record<string, any>
}) {
  
  // 1. Text Summary (Placeholder for AI generation or just showing the description)
  const hasDescription = !!description || fields.some(f => f.type === 'description' && formData[f.name])

  // 2. Numeric Charts
  const numberFields = fields.filter(f => f.type === 'number' && formData[f.name] !== undefined)
  
  // 3. Select / Pie Charts
  const selectFields = fields.filter(f => f.type === 'select' && formData[f.name])
  const categoricalFields = fields.filter(f => {
    if (f.type === 'relation') return relationsData?.[f.name] !== undefined
    return (f.type === 'select' || f.type === 'text') && formData[f.name]
  })
  
  // 4. File / Images
  const fileFields = fields.filter(f => f.type === 'file' && formData[f.name])

  // History logic
  const [history, setHistory] = useState<any[]>([])
  const [categoryHistory, setCategoryHistory] = useState<any[]>([])

  const primaryRelationName = useMemo(() => {
    const rels = fields.filter(f => f.type === 'relation' && relationsData?.[f.name])
    return rels.length > 0 ? rels[0].name : null
  }, [fields, relationsData])
  const primaryRelationId = primaryRelationName ? relationsData?.[primaryRelationName] : null

  // Resolve the actual name of the related entity for UI context
  const [primaryRelationLabel, setPrimaryRelationLabel] = useState<string | null>(null)
  const [allRelationLabels, setAllRelationLabels] = useState<Record<string, string>>({})
  
  const activeRelations = useMemo(() => {
    return fields.filter(f => f.type === 'relation' && relationsData?.[f.name])
  }, [fields, relationsData])
  
  useEffect(() => {
    if (activeRelations.length > 0) {
      const entitiesToResolve = activeRelations.map(f => ({
        target: f.relationTarget || "lead",
        ids: [relationsData![f.name]]
      }))
      
      import("../../actions").then(({ resolveRelationsForSidebar }) => {
        resolveRelationsForSidebar(entitiesToResolve).then(res => {
          setAllRelationLabels(res)
          // also set primary if it matches
          if (primaryRelationId && res[primaryRelationId]) {
            setPrimaryRelationLabel(res[primaryRelationId])
          }
        })
      })
    } else {
      setAllRelationLabels({})
      setPrimaryRelationLabel(null)
    }
  }, [activeRelations, relationsData, primaryRelationId])

  useEffect(() => {
    if (record?.category_id && primaryRelationName && primaryRelationId) {
      getHistoricalRelatedRecords(record.category_id, primaryRelationName, primaryRelationId)
        .then(({ records }) => {
          if (records) setHistory(records)
        })
    } else {
      setHistory([])
    }

    if (record?.category_id && record?.site_id) {
      getRecords(record.site_id, record.category_id)
        .then(({ records }) => {
          if (records) setCategoryHistory(records)
        })
    } else {
      setCategoryHistory([])
    }
  }, [record?.category_id, record?.site_id, primaryRelationName, primaryRelationId])

  // Merge history with current formData
  const chartData = useMemo(() => {
    if (!history.length && !numberFields.length) return []
    
    // Group by date
    const dataPoints = history.map(h => {
      const point: any = { 
        date: new Date(h.created_at).toLocaleDateString(),
        rawDate: new Date(h.created_at)
      }
      numberFields.forEach(f => {
        point[f.name] = Number(h.data[f.name]) || 0
      })
      point.id = h.id
      return point
    })
    
    const currentPoint: any = { 
      date: new Date().toLocaleDateString(), 
      rawDate: new Date(),
      id: record?.id 
    }
    numberFields.forEach(f => {
      currentPoint[f.name] = Number(formData[f.name]) || 0
    })
    
    const existingIndex = dataPoints.findIndex(p => p.id === record?.id)
    if (existingIndex >= 0) {
      // Overwrite with unsaved formData
      dataPoints[existingIndex] = { ...dataPoints[existingIndex], ...currentPoint }
    } else if (record?.id) {
      dataPoints.push(currentPoint)
    }
    
    // Sort by date ascending for chart
    return dataPoints.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
  }, [history, numberFields, formData, record?.id])

  // Aggregate number fields into a single bar chart if there are multiple, or just show the metric
  const numericData = numberFields.map(f => ({
    name: f.name,
    value: Number(formData[f.name]) || 0
  }))

  // Macro-analysis computations (Category level)
  const macroAnalysis = useMemo(() => {
    if (categoryHistory.length === 0) return null

    const totalRecords = categoryHistory.length

    // Sort ascending to calculate time differences
    const sorted = [...categoryHistory].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    
    // Numeric field stats
    const numericStats = numberFields.map(f => {
      const values = sorted.map(p => Number(p.data[f.name])).filter(v => v !== undefined && !isNaN(v))
      if (values.length === 0) return null

      const max = Math.max(...values)
      const min = Math.min(...values)
      const avg = values.reduce((a, b) => a + b, 0) / values.length

      return {
        name: f.name,
        avg: avg.toFixed(1),
        min,
        max
      }
    }).filter(Boolean)

    // Categorical mode for select and relation fields
    const categoricalStats = categoricalFields.map(f => {
      // Gather historical + current
      const allValues = sorted.map(h => {
        if (f.type === 'relation') {
          // Resolve relation from ID? We might only have the ID here. Let's just use the ID for now, 
          // or if we have relationsData we could map it, but we only have relationsData for the current record.
          // Wait, h.relations[f.name] might have the ID!
          return h.relations?.[f.name]
        }
        return h.data[f.name]
      }).filter(Boolean)
      
      if (f.type === 'relation' && formData[f.name]) {
        // formData doesn't hold relation IDs, relationsData does
        if (relationsData?.[f.name]) {
          allValues.push(relationsData[f.name])
        }
      } else if (formData[f.name]) {
        allValues.push(formData[f.name])
      }

      const frequencies: Record<string, number> = {}
      allValues.forEach(val => {
        frequencies[val] = (frequencies[val] || 0) + 1
      })

      let modeId = null
      let maxFreq = 0
      Object.entries(frequencies).forEach(([val, freq]) => {
        if (freq > maxFreq) {
          maxFreq = freq
          modeId = val
        }
      })

      return {
        name: f.name,
        type: f.type,
        modeId,
        count: maxFreq
      }
    }).filter(s => s.modeId !== null)

    return {
      totalRecords,
      numericStats,
      categoricalStats
    }
  }, [categoryHistory, numberFields, categoricalFields, formData, relationsData])
  const [macroRelationLabels, setMacroRelationLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    if (macroAnalysis?.categoricalStats) {
      const entitiesToResolve: { target: string; ids: string[] }[] = []
      
      macroAnalysis.categoricalStats.forEach(stat => {
        if (stat.type === 'relation' && stat.modeId) {
          const relField = fields.find(f => f.name === stat.name)
          if (relField) {
            entitiesToResolve.push({
              target: relField.relationTarget || "lead",
              ids: [stat.modeId]
            })
          }
        }
      })

      if (entitiesToResolve.length > 0) {
        import("../../actions").then(({ resolveRelationsForSidebar }) => {
          resolveRelationsForSidebar(entitiesToResolve).then(res => {
            setMacroRelationLabels(res)
          })
        })
      }
    }
  }, [macroAnalysis?.categoricalStats, fields])

  const dynamicCrosses = useMemo(() => {
    if (categoryHistory.length === 0) return []

    const crosses: any[] = []
    const seenCatVsCat = new Set<string>()

    categoricalFields.forEach(catField => {
      let currentVal = formData[catField.name]
      if (catField.type === 'relation') {
         currentVal = relationsData?.[catField.name]
      }
      if (!currentVal) return

      const subset = categoryHistory.filter(h => {
        if (catField.type === 'relation') return h.relations?.[catField.name] === currentVal
        return h.data[catField.name] === currentVal
      })

      if (subset.length <= 1) return // Need at least 2 records for a meaningful cross-analysis

      // Cross 1: Categorical vs Numeric
      numberFields.forEach(numField => {
        const subsetVals = subset.map(h => Number(h.data[numField.name])).filter(v => !isNaN(v))
        if (subsetVals.length === 0) return
        
        const subsetAvg = subsetVals.reduce((a, b) => a + b, 0) / subsetVals.length
        
        const allVals = categoryHistory.map(h => Number(h.data[numField.name])).filter(v => !isNaN(v))
        const overallAvg = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0
        
        if (overallAvg > 0) {
          const diff = ((subsetAvg - overallAvg) / overallAvg) * 100
          crosses.push({
            type: 'cat_vs_num',
            catName: catField.name,
            catVal: currentVal,
            isRelation: catField.type === 'relation',
            numName: numField.name,
            subsetAvg,
            overallAvg,
            diff,
            count: subset.length
          })
        }
      })

      // Cross 2: Categorical vs Categorical
      categoricalFields.forEach(otherCatField => {
        if (catField.name === otherCatField.name) return
        
        // Avoid duplicates (A vs B is same context as B vs A if we just look at correlations, but here we are saying "Given A, most common B is...")
        // Actually, "Given A, B" is different from "Given B, A". So we can keep it, but maybe limit to strong ones.
        
        const frequencies: Record<string, number> = {}
        subset.forEach(h => {
          let val = h.data[otherCatField.name]
          if (otherCatField.type === 'relation') {
            val = h.relations?.[otherCatField.name]
          }
          if (val) {
            frequencies[val] = (frequencies[val] || 0) + 1
          }
        })
        
        let modeVal = null
        let maxFreq = 0
        Object.entries(frequencies).forEach(([v, f]) => {
          if (f > maxFreq) {
            maxFreq = f
            modeVal = v
          }
        })

        // If this mode value appears in more than 50% of the subset, it's a strong correlation
        if (modeVal && maxFreq > 0 && (maxFreq / subset.length) >= 0.5) {
          const crossKey = [catField.name, otherCatField.name].sort().join('-')
          if (!seenCatVsCat.has(crossKey)) {
            seenCatVsCat.add(crossKey)
            crosses.push({
              type: 'cat_vs_cat',
              catName: catField.name,
              catVal: currentVal,
              isRelation: catField.type === 'relation',
              otherCatName: otherCatField.name,
              otherCatVal: modeVal,
              isOtherRelation: otherCatField.type === 'relation',
              count: maxFreq,
              totalSubset: subset.length,
              percentage: Math.round((maxFreq / subset.length) * 100)
            })
          }
        }
      })
    })

    return crosses
  }, [categoryHistory, formData, relationsData, categoricalFields, numberFields])

  const metaAnalysis = useMemo(() => {
    if (chartData.length === 0) return null

    const totalRecords = chartData.length

    // Sort ascending to calculate time differences
    const sorted = [...chartData].sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
    const firstDate = sorted[0].rawDate
    const lastDate = sorted[sorted.length - 1].rawDate
    
    const daysSinceFirst = Math.max(0, Math.floor((new Date().getTime() - firstDate.getTime()) / (1000 * 3600 * 24)))
    const daysSinceLast = Math.max(0, Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24)))

    // Calculate average periodicity
    let avgPeriodicity = 0
    if (totalRecords > 1) {
      const diffs = []
      for (let i = 1; i < sorted.length; i++) {
        const diffMs = sorted[i].rawDate.getTime() - sorted[i-1].rawDate.getTime()
        diffs.push(diffMs / (1000 * 3600 * 24))
      }
      avgPeriodicity = diffs.reduce((a, b) => a + b, 0) / diffs.length
    }

    // Numeric field stats
    const numericStats = numberFields.map(f => {
      const values = sorted.map(p => p[f.name]).filter(v => v !== undefined && !isNaN(v))
      if (values.length === 0) return null

      const max = Math.max(...values)
      const min = Math.min(...values)
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const current = Number(formData[f.name]) || 0

      let trend = 0
      if (avg > 0) {
        trend = ((current - avg) / avg) * 100
      }

      return {
        name: f.name,
        avg: avg.toFixed(1),
        min,
        max,
        current,
        trend: trend.toFixed(1)
      }
    }).filter(Boolean)

    // Categorical mode (most frequent value)
    const categoricalStats = selectFields.map(f => {
      // Gather historical + current
      const allValues = history.map(h => h.data[f.name]).filter(Boolean)
      if (formData[f.name]) {
        allValues.push(formData[f.name])
      }

      const frequencies: Record<string, number> = {}
      allValues.forEach(val => {
        frequencies[val] = (frequencies[val] || 0) + 1
      })

      let mode = null
      let maxFreq = 0
      Object.entries(frequencies).forEach(([val, freq]) => {
        if (freq > maxFreq) {
          maxFreq = freq
          mode = val
        }
      })

      return {
        name: f.name,
        mode,
        count: maxFreq
      }
    }).filter(s => s.mode !== null)

    return {
      activity: {
        totalRecords,
        avgPeriodicity: Math.round(avgPeriodicity),
        daysSinceFirst,
        daysSinceLast
      },
      numericStats,
      categoricalStats
    }
  }, [chartData, numberFields, selectFields, history, formData])

  return (
    <div className="space-y-10 pb-8 px-2">
      
      {/* Description Summary */}
      {hasDescription && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Content Summary</span>
          </div>
          <div className="text-sm leading-relaxed text-foreground/90">
            {description ? (
              <p className="line-clamp-6">{description}</p>
            ) : (
              <p className="italic text-muted-foreground">Detailed text content is available in the record fields.</p>
            )}
          </div>
        </section>
      )}

      {/* Numeric Chart (Evolution Line or Bar) */}
      {numericData.length > 0 && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <ChartIcon className="h-4 w-4" />
            <span>
              {numberFields.length === 1 
                ? `${numberFields[0].name} Evolution` 
                : 'Metrics Evolution'}
            </span>
          </div>
          <div className="h-[200px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartData.length >= 2 ? (
                <LineChart data={chartData}>
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" width={30} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }} 
                  />
                  {numberFields.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />}
                  {numberFields.map((f, i) => (
                    <Line 
                      key={f.name} 
                      type="monotone" 
                      dataKey={f.name} 
                      stroke={COLORS[i % COLORS.length]} 
                      strokeWidth={3}
                      activeDot={{ r: 6, strokeWidth: 0 }} 
                      dot={{ r: 3, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={numericData}>
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" width={30} />
                  <Tooltip 
                    cursor={{ fill: 'var(--muted)', opacity: 0.4 }} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }} 
                  />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Meta-Analysis */}
      {metaAnalysis && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Activity className="h-4 w-4" />
            <span>
              {primaryRelationLabel 
                ? `${primaryRelationLabel} Analysis` 
                : primaryRelationName 
                  ? `${primaryRelationName} Analysis` 
                  : (record?.category?.name ? `${record.category.name} Analysis` : 'Meta-Analysis')}
            </span>
          </div>
          
          <div className="space-y-8">
            {/* Activity Summary */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-3 border-b border-border/30 pb-1">Activity Summary</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div>
                  <div className="text-[11px] text-muted-foreground mb-0.5">Total Records</div>
                  <div className="text-xl font-medium tracking-tight">{metaAnalysis.activity.totalRecords}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-0.5">Avg. Periodicity</div>
                  <div className="text-xl font-medium tracking-tight">{metaAnalysis.activity.avgPeriodicity} <span className="text-xs text-muted-foreground font-normal">days</span></div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-0.5">Active Since</div>
                  <div className="text-xl font-medium tracking-tight">{metaAnalysis.activity.daysSinceFirst} <span className="text-xs text-muted-foreground font-normal">days</span></div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-0.5">Last Active</div>
                  <div className="text-xl font-medium tracking-tight">{metaAnalysis.activity.daysSinceLast} <span className="text-xs text-muted-foreground font-normal">days ago</span></div>
                </div>
              </div>
            </div>

            {/* Numeric Stats */}
            {metaAnalysis.numericStats.length > 0 && (
              <div className="space-y-4">
                {metaAnalysis.numericStats.map((stat: any) => (
                  <div key={stat.name}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-3 border-b border-border/30 pb-1">{stat.name} Trends</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Historical Avg</div>
                        <div className="text-lg font-medium">{stat.avg}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Min - Max</div>
                        <div className="text-lg font-medium">{stat.min} - {stat.max}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Vs. Average</div>
                        <div className={`text-lg font-medium flex items-center gap-1 ${Number(stat.trend) > 0 ? 'text-emerald-500' : Number(stat.trend) < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {Number(stat.trend) > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                          {Number(stat.trend) > 0 ? '+' : ''}{stat.trend}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Categorical Stats */}
            {metaAnalysis.categoricalStats.length > 0 && (
              <div className="space-y-4">
                {metaAnalysis.categoricalStats.map((stat: any) => (
                  <div key={stat.name}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 border-b border-border/30 pb-1">Most Frequent {stat.name}</h4>
                    <div>
                      <div className="text-lg font-medium">{stat.mode}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Selected {stat.count} times</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Macro-Analysis (Category level) */}
      {macroAnalysis && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Folder className="h-4 w-4" />
            <span>
              {record?.category?.name ? `Global ${record.category.name} Analysis` : 'Global Category Analysis'}
            </span>
          </div>
          
          <div className="space-y-8">
            {/* Macro Summary */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-3 border-b border-border/30 pb-1">Category Summary</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div>
                  <div className="text-[11px] text-muted-foreground mb-0.5">Total Records</div>
                  <div className="text-xl font-medium tracking-tight">{macroAnalysis.totalRecords}</div>
                </div>
              </div>
            </div>

            {/* Macro Numeric Stats */}
            {macroAnalysis.numericStats.length > 0 && (
              <div className="space-y-4">
                {macroAnalysis.numericStats.map((stat: any) => (
                  <div key={stat.name}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-3 border-b border-border/30 pb-1">Global {stat.name}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Category Avg</div>
                        <div className="text-lg font-medium">{stat.avg}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Min - Max</div>
                        <div className="text-lg font-medium">{stat.min} - {stat.max}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Macro Categorical Stats */}
            {macroAnalysis.categoricalStats.length > 0 && (
              <div className="space-y-4">
                {macroAnalysis.categoricalStats.map((stat: any) => (
                  <div key={stat.name}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 border-b border-border/30 pb-1">Top {stat.name}</h4>
                    <div>
                      <div className="text-lg font-medium">
                        {stat.type === 'relation' ? macroRelationLabels[stat.modeId] || 'Loading...' : stat.modeId}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Occurs {stat.count} times in category</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Dynamic Cross Insights */}
      {dynamicCrosses.length > 0 && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Cross-Insights</span>
          </div>
          
          <div className="space-y-6">
            {dynamicCrosses.map((cross, idx) => {
              const catLabel = cross.isRelation && allRelationLabels[cross.catVal] ? allRelationLabels[cross.catVal] : cross.catVal
              
              if (cross.type === 'cat_vs_num') {
                return (
                  <div key={`cross-${idx}`}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-3 border-b border-border/30 pb-1">
                      {cross.catName} &times; {cross.numName}
                    </h4>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      When <span className="font-medium">{cross.catName}</span> is <span className="font-medium">{catLabel}</span>, 
                      average <span className="font-medium">{cross.numName}</span> is <span className="font-medium">{cross.subsetAvg.toFixed(1)}</span>.
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      <span className="text-muted-foreground">Category Avg: {cross.overallAvg.toFixed(1)}</span>
                      <span className={`flex items-center gap-1 font-medium ${cross.diff > 0 ? 'text-emerald-500' : cross.diff < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {cross.diff > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                        {cross.diff > 0 ? '+' : ''}{cross.diff.toFixed(1)}% vs avg
                      </span>
                    </div>
                  </div>
                )
              }
              
              if (cross.type === 'cat_vs_cat') {
                const otherCatLabel = cross.isOtherRelation && allRelationLabels[cross.otherCatVal] ? allRelationLabels[cross.otherCatVal] : cross.otherCatVal
                return (
                  <div key={`cross-${idx}`}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-3 border-b border-border/30 pb-1">
                      {cross.catName} &times; {cross.otherCatName}
                    </h4>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      When <span className="font-medium">{cross.catName}</span> is <span className="font-medium">{catLabel}</span>, 
                      most common <span className="font-medium">{cross.otherCatName}</span> is <span className="font-medium">{otherCatLabel}</span>.
                    </p>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Occurs in {cross.percentage}% of these cases ({cross.count} of {cross.totalSubset})
                    </div>
                  </div>
                )
              }
              
              return null
            })}
          </div>
        </section>
      )}

      {/* Categories */}
      {selectFields.length > 0 && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <PieIcon className="h-4 w-4" />
            <span>Categories</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {selectFields.map((field, i) => {
              const val = formData[field.name]
              const data = [
                { name: val, value: 1 },
                { name: 'Other', value: 0 }
              ]
              return (
                <div key={field.id} className="flex flex-col items-center">
                  <div className="h-[80px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={35}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
                        >
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(i + index) % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <span className="text-xs font-medium mt-2">{field.name}</span>
                  <span className="text-[11px] text-muted-foreground">{val || 'None'}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Files / Media */}
      {fileFields.length > 0 && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <ImageIcon className="h-4 w-4" />
            <span>Media</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {fileFields.map(field => {
              const url = formData[field.name]
              const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('image')
              return (
                <div key={field.id} className="aspect-square bg-muted/30 rounded-xl overflow-hidden relative group">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={field.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2 p-2 text-center text-muted-foreground">
                      <FileText className="h-6 w-6 opacity-50" />
                      <span className="text-[10px] truncate w-full px-2">{url.split('/').pop()}</span>
                    </div>
                  )}
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-medium transition-opacity backdrop-blur-sm"
                  >
                    View File
                  </a>
                </div>
              )
            })}
          </div>
        </section>
      )}
      
      {/* AI Previews */}
      {fields.filter(f => f.aiPreview?.enabled).length > 0 && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Generated Previews</span>
          </div>
          <div className="space-y-8">
            {fields.filter(f => f.aiPreview?.enabled).map(previewField => {
              
              const hasActiveRelations = activeRelations.length > 0
              
              if (hasActiveRelations) {
                return activeRelations.map(rel => {
                  const relId = relationsData?.[rel.name]
                  if (!relId) return null

                  const relLabel = allRelationLabels[relId] || relId
                  
                  // Find all records that share this relation
                  const relatedRecords = categoryHistory.filter(h => h.relations?.[rel.name] === relId)
                  
                  // Build carousel items
                  const items: any[] = []
                  
                  // Add history records first (oldest to newest)
                  relatedRecords.forEach(h => {
                    if (h.id !== record?.id && h.data[previewField.name]) {
                      items.push({
                        id: h.id,
                        value: h.data[previewField.name],
                        label: new Date(h.created_at).toLocaleDateString(),
                        isCurrent: false,
                        date: new Date(h.created_at).getTime()
                      })
                    }
                  })
                  
                  items.sort((a, b) => a.date - b.date)
                  
                  // Add current record last
                  if (formData[previewField.name]) {
                    items.push({
                      id: record?.id || 'current',
                      value: formData[previewField.name],
                      label: 'Current',
                      isCurrent: true,
                      date: Date.now()
                    })
                  }
                  
                  if (items.length === 0) return null

                  return (
                    <div key={`${previewField.id}-${rel.id}`}>
                      <h4 className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        {previewField.name} - {relLabel}
                      </h4>
                      <div className="flex gap-2 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {items.map(item => {
                          const finalPrompt = (previewField.aiPreview.promptTemplate || "Generate an image about: {value}").replace(/{value}/g, item.value)
                          let domain = "http://localhost:3001"
                          if (typeof window !== "undefined") {
                            if (window.location.hostname.includes("makinari.com")) domain = "https://app.makinari.com"
                            else if (window.location.hostname.includes("market-fit.ai")) domain = "https://api.market-fit.ai"
                          }
                          const url = `${domain}/api/public/image/prompt/${encodeURIComponent(finalPrompt)}?width=512&height=512`
                          
                          return (
                            <div key={item.id} className={`flex-none w-28 rounded-lg overflow-hidden relative group shadow-sm border ${item.isCurrent ? 'border-primary' : 'border-border/40'} snap-start`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={url} 
                                alt={item.value} 
                                className="w-full h-24 object-cover bg-muted/20" 
                                onError={(e) => {
                                  console.error("Failed to load AI image:", url)
                                  e.currentTarget.src = "/images/placeholder-image.png"
                                }}
                              />
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-medium transition-opacity backdrop-blur-sm"
                              >
                                <span>Full Size</span>
                                <span className="text-[9px] mt-1 font-normal opacity-80 max-w-[90%] truncate px-1 text-center">{item.value}</span>
                              </a>
                              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-md truncate max-w-[90%]">
                                {item.label}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              } else {
                // If no relations, just show current
                if (!formData[previewField.name]) return null

                const finalPrompt = (previewField.aiPreview.promptTemplate || "Generate an image about: {value}").replace(/{value}/g, formData[previewField.name])
                let domain = "http://localhost:3001"
                if (typeof window !== "undefined") {
                  if (window.location.hostname.includes("makinari.com")) domain = "https://app.makinari.com"
                  else if (window.location.hostname.includes("market-fit.ai")) domain = "https://api.market-fit.ai"
                }
                const url = `${domain}/api/public/image/prompt/${encodeURIComponent(finalPrompt)}?width=512&height=512`
                
                return (
                  <div key={previewField.id}>
                    <h4 className="text-[11px] font-medium text-muted-foreground mb-2">{previewField.name}</h4>
                    <div className="w-full rounded-lg overflow-hidden relative group shadow-sm border border-border/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={url} 
                        alt={previewField.name} 
                        className="w-full h-auto object-cover min-h-[120px] bg-muted/20" 
                        onError={(e) => {
                          console.error("Failed to load AI image:", url)
                          e.currentTarget.src = "/images/placeholder-image.png"
                        }}
                      />
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-medium transition-opacity backdrop-blur-sm"
                      >
                        <span>Full Size</span>
                        <span className="text-[10px] mt-1 font-normal opacity-80 max-w-[90%] truncate px-2 text-center">{formData[previewField.name]}</span>
                      </a>
                      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md">
                        Current
                      </div>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!hasDescription && numericData.length === 0 && selectFields.length === 0 && fileFields.length === 0 && (
        <div className="text-center py-12 px-4 text-muted-foreground text-sm border border-dashed rounded-xl bg-muted/10">
          <p>No data available for insights.</p>
          <p className="text-xs mt-1 opacity-70">Fill out the record fields to generate visualizations.</p>
        </div>
      )}

      {/* Record Metadata / Details */}
      <section>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          <Folder className="h-4 w-4 text-primary" />
          <span>Record Details</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <div className="text-muted-foreground flex items-center gap-2">
              <Folder className="h-3.5 w-3.5" />
              Category
            </div>
            <div className="font-medium text-foreground">
              {record?.category?.name || "Uncategorized"}
            </div>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <div className="text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Created At
            </div>
            <div className="font-medium text-foreground">
              {record?.created_at ? new Date(record.created_at).toLocaleString() : "Unknown"}
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}