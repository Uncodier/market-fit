import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts"
import { Sparkles, FileText, BarChart as ChartIcon, PieChart as PieIcon, Image as ImageIcon, Activity, TrendingUp, Clock, Folder } from "@/app/components/ui/icons"
import { InsightGeneratedPreviews } from "./InsightGeneratedPreviews"
import { useRecordInsights } from "./use-record-insights"
import type { InsightsTabProps } from "./insights-types"

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export function InsightsTab({ fields, formData, description, record, relationsData }: InsightsTabProps) {
  const {
    hasDescription, numberFields, selectFields, fileFields,
    chartData, numericData, metaAnalysis, macroAnalysis, dynamicCrosses,
    primaryRelationName, primaryRelationLabel, macroRelationLabels,
    activeRelations, allRelationLabels, categoryHistory,
  } = useRecordInsights({ fields, formData, description, record, relationsData })

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
                {metaAnalysis.numericStats.map((stat) => (
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
                {metaAnalysis.categoricalStats.map((stat) => (
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
                {macroAnalysis.numericStats.map((stat) => (
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
                {macroAnalysis.categoricalStats.map((stat) => (
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
      <InsightGeneratedPreviews
        fields={fields}
        formData={formData}
        record={record}
        relationsData={relationsData}
        activeRelations={activeRelations}
        allRelationLabels={allRelationLabels}
        categoryHistory={categoryHistory}
      />

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