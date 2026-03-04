"use client"

import { useState } from "react"
import Link from "next/link"
import { agents } from "@/app/data/mock-agents"
import { Button } from "@/app/components/ui/button"
import * as Icons from "@/app/components/ui/icons"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { OpenClawCard } from "@/app/components/auth/sections/OpenClawCard"
import { useLocalization } from "@/app/context/LocalizationContext"

const getCategories = (t: (k: string) => string) => [
    { id: "all", label: t('features.stages.all.title') || "All Features" },
    { id: "marketing", label: t('features.stages.find.title') || "Find" },
    { id: "sales", label: t('features.stages.contact.title') || "Contact" },
    { id: "product", label: t('features.stages.sell.title') || "Sell" },
    { id: "management", label: t('features.stages.manage.title') || "Manage" },
]

export function AgentsClient() {
  const { t } = useLocalization()
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const categories = getCategories(t)

  // Flatten all activities and attach agent info
  const allActivities = agents.flatMap(agent => 
    (agent.activities || []).map(activity => ({
      ...activity,
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role || agent.name,
      agentIcon: agent.icon,
      categoryId: agent.type || "other"
    }))
  )

  // Filter activities based on active category
  const filteredActivities = allActivities.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.agentName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === "all" || a.categoryId === activeCategory
    
    return matchesSearch && matchesCategory
  })

  // Map of icons for specific activity themes (to make it look varied like the screenshot)
  const getActivityIcon = (activityName: string, agentIcon: string) => {
    const name = activityName.toLowerCase();
    if (name.includes('search') || name.includes('mining') || name.includes('sourcing')) return 'Search';
    if (name.includes('data') || name.includes('analys')) return 'BarChart';
    if (name.includes('lead') || name.includes('contact') || name.includes('email')) return 'Mail';
    if (name.includes('score') || name.includes('qualify') || name.includes('trend')) return 'TrendingUp';
    if (name.includes('manage') || name.includes('coord')) return 'Users';
    if (name.includes('content') || name.includes('copy')) return 'FileText';
    if (name.includes('campaign') || name.includes('seo')) return 'Target';
    if (name.includes('design') || name.includes('ux')) return 'Palette';
    if (name.includes('task') || name.includes('valid')) return 'CheckCircle';
    if (name.includes('support') || name.includes('faq') || name.includes('knowledge')) return 'HelpCircle';
    
    return agentIcon || 'Zap';
  };

  const getIconColor = (categoryId: string) => {
    switch (categoryId) {
      case 'marketing': return 'text-[#F97316] bg-orange-50 dark:bg-orange-500/10 border border-orange-500/20'; // Orange
      case 'sales': return 'text-[#3B82F6] bg-blue-50 dark:bg-blue-500/10 border border-blue-500/20'; // Blue
      case 'product': return 'text-[#10B981] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20'; // Emerald
      case 'management': return 'text-[#8B5CF6] bg-violet-50 dark:bg-violet-500/10 border border-violet-500/20'; // Violet
      default: return 'text-slate-500 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10';
    }
  };

  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white dark:bg-transparent rounded-full blur-[100px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
            {t('common.useCases') || 'Use Cases'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            {t('agents.hero.title.start') || 'AI Agents for '} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">{t('agents.hero.title.highlight') || 'Every Workflow'}</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-8">
            {t('agents.hero.subtitle') || 'Discover how our specialized AI agents can automate and streamline your operations across every stage of your revenue cycle.'}
          </p>
        </div>
      </section>

      {/* Employees Card Section */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full">
        <OpenClawCard />
      </section>

      {/* Main Content */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full flex-1">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">
              {t('agents.grid.title') || 'Explore some agent capabilities'}
            </h2>
            <p className="dark:text-white/50 text-slate-500 text-lg max-w-xl">
              {t('agents.grid.subtitle') || 'Browse through the tasks and operations our AI workforce can automate for your team.'}
            </p>
          </div>
          
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0a0a0c] border border-black/10 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white transition-all shadow-sm"
              placeholder={t('agents.grid.search') || 'Search capabilities...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-10 lg:gap-16">
          {/* Sidebar */}
          <div className="w-full lg:w-48 flex-shrink-0">
            <nav className="sticky top-24">
              <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 gap-1.5 scrollbar-hide">
                <div className="hidden lg:block mb-4 px-4 py-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-bold w-fit uppercase tracking-wider">
                  {t('common.useCases') || 'Use Cases'}
                </div>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`whitespace-nowrap flex lg:w-full items-center px-4 py-2.5 text-[14px] font-bold rounded-[10px] transition-all text-left ${
                      activeCategory === category.id
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </nav>
          </div>

            {/* Grid Area */}
            <div className="flex-1">
              {filteredActivities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredActivities.map((activity) => {
                    const iconName = getActivityIcon(activity.name, activity.agentIcon);
                    const IconComponent = Icons[iconName as keyof typeof Icons] || Icons.Zap;
                    const colorClasses = getIconColor(activity.categoryId);

                      return (
                <Link 
                  href={`/product/agents/${activity.agentId}`}
                  key={activity.id} 
                  className="group rounded-2xl dark:bg-[#0f0f13] bg-white border dark:border-white/10 border-black/10 p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer flex flex-col h-full"
                >
                        <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-[14px] ${colorClasses}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        
                  <h3 className="mb-2 font-bold text-[17px] leading-tight tracking-tight dark:text-white text-slate-900 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {activity.name}
                  </h3>
                  
                  <div className="mb-4 flex items-center text-[11px] font-bold uppercase tracking-wider dark:text-white/50 text-slate-500">
                    <span className="dark:text-white/70 text-slate-700">{categories.find(c => c.id === activity.categoryId)?.label?.split(' ')[0]}</span>
                    <span className="mx-2 dark:text-white/20 text-black/20">•</span>
                    <span className="truncate">{activity.agentName}</span>
                  </div>
                  
                  <p className="text-[14px] dark:text-slate-400 text-slate-500 leading-relaxed mt-auto mb-4">
                    {activity.description}
                  </p>
                  
                  <div className="mt-auto flex items-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 duration-300">
                    <span className={getIconColor(activity.categoryId).split(' ')[0]}>View agent details</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ml-1 ${getIconColor(activity.categoryId).split(' ')[0]}`}>
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full py-20 flex flex-col items-center justify-center text-center border border-dashed dark:border-white/10 border-black/10 rounded-2xl">
                  <div className="w-16 h-16 rounded-full dark:bg-white/5 bg-slate-100 flex items-center justify-center mb-4">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-slate-400">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-2">{t('agents.grid.empty.title') || 'No agents found'}</h3>
                  <p className="dark:text-slate-400 text-slate-500 max-w-sm">
                    {t('agents.grid.empty.subtitle') || `We couldn't find any agent activities matching "${searchQuery}". Try adjusting your filters or search term.`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
