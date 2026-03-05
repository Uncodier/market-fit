"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { ChevronLeft, CheckCircle2, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"
import { features } from "@/app/product/features/features-data"
import { integrations } from "@/app/product/integrations/integrations-data"
import { agents } from "@/app/data/mock-agents"

import { useLocalization } from "@/app/context/LocalizationContext"

export function UseCaseDetailClient({ useCase }: { useCase: any }) {
  const { t } = useLocalization()
  // Color configuration based on feature color
  const colorConfig = {
    orange: {
      bgBlur: "bg-orange-500/10 dark:bg-orange-500/5",
      btnPrimary: "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]",
      textAccent: "text-orange-600 dark:text-orange-400",
      bgAccent: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
      checkColor: "text-orange-500",
      hoverText: "hover:text-orange-700 dark:hover:text-orange-300"
    },
    blue: {
      bgBlur: "bg-blue-500/10 dark:bg-blue-500/5",
      btnPrimary: "bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]",
      textAccent: "text-blue-600 dark:text-blue-400",
      bgAccent: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
      checkColor: "text-blue-500",
      hoverText: "hover:text-blue-700 dark:hover:text-blue-300"
    },
    emerald: {
      bgBlur: "bg-emerald-500/10 dark:bg-emerald-500/5",
      btnPrimary: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]",
      textAccent: "text-emerald-600 dark:text-emerald-400",
      bgAccent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
      checkColor: "text-emerald-500",
      hoverText: "hover:text-emerald-700 dark:hover:text-emerald-300"
    },
    violet: {
      bgBlur: "bg-violet-500/10 dark:bg-violet-500/5",
      btnPrimary: "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]",
      textAccent: "text-violet-600 dark:text-violet-400",
      bgAccent: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
      checkColor: "text-violet-500",
      hoverText: "hover:text-violet-700 dark:hover:text-violet-300"
    }
  };

  const theme = colorConfig[useCase.color as keyof typeof colorConfig] || colorConfig.emerald;
  
  // Calculate related items deterministically based on useCase category/id
  const getRelatedItems = () => {
    // Basic scoring function based on keywords
    const categoryLower = (useCase.category || '').toLowerCase();
    const idLower = (useCase.id || '').toLowerCase();
    const descLower = (useCase.description || '').toLowerCase();
    
    // Default values
    let selectedFeatureIds = ['tam-sourcing', 'sequencing', 'crm'];
    let selectedIntegrationIds = ['gmail', 'slack', 'notion'];
    let selectedAgentIds = ['mkn1', 'mkn4', 'mkn7']; // Gear, Script, Vector
    
    // Adjust based on category/keywords
    if (categoryLower.includes('solopreneur') || idLower.includes('solopreneur')) {
      selectedFeatureIds = ['automatic-follow-up', 'scheduler', 'smart-composer'];
      selectedIntegrationIds = ['gmail', 'whatsapp', 'stripe'];
      selectedAgentIds = ['mkn1', 'mkn4', 'mkn2']; // Gear, Script, Pixel
    } else if (categoryLower.includes('b2b') || idLower.includes('b2b')) {
      selectedFeatureIds = ['tam-sourcing', 'sequencing', 'domain-inbox'];
      selectedIntegrationIds = ['salesforce', 'hubspot', 'linkedin'];
      selectedAgentIds = ['mkn9', 'mkn7', 'mkn4']; // Recon, Vector, Script
    } else if (categoryLower.includes('smb') || idLower.includes('smb')) {
      selectedFeatureIds = ['crm', 'inbound-automation', 'ad-management'];
      selectedIntegrationIds = ['hubspot', 'mailchimp', 'slack'];
      selectedAgentIds = ['mkn1', 'mkn4', 'mkn7']; // Gear, Script, Vector
    } else if (categoryLower.includes('startup') || idLower.includes('startup')) {
      selectedFeatureIds = ['icp-generation', 'intent-signals', 'lead-scoring'];
      selectedIntegrationIds = ['slack', 'notion', 'stripe'];
      selectedAgentIds = ['mkn6', 'mkn2', 'mkn7']; // Root, Pixel, Vector
    } else if (categoryLower.includes('enterprise') || categoryLower.includes('scaleup')) {
      selectedFeatureIds = ['domain-inbox', 'workflows', 'reporting'];
      selectedIntegrationIds = ['salesforce', 'postgres', 'temporal'];
      selectedAgentIds = ['mkn1', 'mkn5', 'mkn6']; // Gear, Ledger, Root
    }

    return {
      relatedFeatures: features.filter(f => selectedFeatureIds.includes(f.id)).slice(0, 3),
      relatedIntegrations: integrations.filter(i => selectedIntegrationIds.includes(i.id)).slice(0, 3),
      relatedAgents: agents.filter(a => selectedAgentIds.includes(a.id)).slice(0, 3)
    };
  };

  const { relatedFeatures, relatedIntegrations, relatedAgents } = getRelatedItems();

  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] ${theme.bgBlur} rounded-full blur-[100px] opacity-100 pointer-events-none`}></div>
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-12">
          <Link href="/product/use-cases" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8 transition-colors">
            <ChevronLeft size={16} className="mr-1" />
            {t('useCases.detail.backToUseCases') || 'Back to Use Cases'}
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-24 h-24 rounded-2xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-slate-50 dark:bg-black/50 flex items-center justify-center shadow-lg p-4 flex-shrink-0">
              {React.cloneElement(useCase.icon as React.ReactElement, { className: "w-full h-full object-contain" })}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {useCase.name}
                </h1>
                {useCase.status === 'beta' && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${theme.bgAccent}`}>
                    {t('common.beta') || 'Beta'}
                  </span>
                )}
                {useCase.status === 'coming_soon' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                    {t('common.soon') || 'Soon'}
                  </span>
                )}
              </div>
              <div className={`font-medium mb-4 flex items-center gap-2 ${theme.textAccent}`}>
                <span className="font-semibold uppercase tracking-wider text-xs px-2 py-0.5 rounded border border-current">{t(`useCases.categories.${(useCase.category || '').toLowerCase().replace(' & ', '')}.title`) || useCase.category}</span>
              </div>
              <p className="text-lg md:text-xl dark:text-white/60 text-slate-500 max-w-2xl font-light leading-relaxed">
                {useCase.description}
              </p>
            </div>
            
            <div className="w-full md:w-auto mt-4 md:mt-0 flex flex-col sm:flex-row md:flex-col gap-3">
              {useCase.status === 'coming_soon' ? (
                <button 
                  className="px-8 py-3.5 rounded-full font-inter font-bold transition-all shadow-sm flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  disabled
                >
                  {t('common.joinWaitlist') || 'Join Waitlist'}
                </button>
              ) : (
              <Link 
                href="/auth?mode=register"
                className={`px-8 py-3.5 rounded-full font-inter font-bold transition-all shadow-sm flex items-center justify-center gap-2 group ${theme.btnPrimary}`}
              >
                {t('common.getStarted') || 'Start with Makinari'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 max-w-5xl mx-auto px-6 lg:px-12 w-full flex-1 flex flex-col md:flex-row gap-12">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
            {t('useCases.detail.howItHelps') || 'How Makinari helps'} {t(`useCases.categories.${(useCase.category || '').toLowerCase().replace(' & ', '')}.title`) || useCase.name}
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
            {useCase.longDescription ? (
              useCase.longDescription.split('\n\n').map((para: string, index: number) => (
                <p key={index} className="mb-4">
                  {para}
                </p>
              ))
            ) : (
              <p className="mb-4">
                {t('useCases.detail.defaultDesc.part1') || 'Makinari empowers'} {useCase.name.toLowerCase()} {t('useCases.detail.defaultDesc.part2') || 'businesses by providing an automated Go-To-Market infrastructure. By using advanced AI agents, you can completely transform your'} {t(`useCases.categories.${(useCase.category || '').toLowerCase().replace(' & ', '')}.title`) || useCase.category} {t('useCases.detail.defaultDesc.part3') || 'strategy, generate more qualified leads, and close deals faster without adding headcount.'}
              </p>
            )}
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">{t('useCases.detail.keyWorkflows') || 'Key Workflows'}</h3>
            <ul className="space-y-3 mb-8">
              {(useCase.keyWorkflows || [
                t('useCases.detail.workflow.default1') || `Set up personalized, automated outreach tailored precisely for your ideal customer profile.`,
                t('useCases.detail.workflow.default2') || `Streamline initial qualification and routing automatically.`,
                t('useCases.detail.workflow.default3') || `Trigger automated follow-ups based on prospect intent.`
              ]).map((workflow: string, index: number) => (
                <li key={index} className="flex items-start">
                  <CheckCircle2 size={20} className={`${theme.checkColor} mr-3 mt-0.5 flex-shrink-0`} />
                  <span className="text-slate-600 dark:text-slate-300">
                    {workflow}
                  </span>
                </li>
              ))}
            </ul>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">{t('useCases.detail.expectedOutcomes') || 'Expected Outcomes'}</h3>
            <p className="text-slate-600 dark:text-slate-300">
              {useCase.expectedOutcomes || `${t('useCases.detail.outcome.default1') || 'Businesses in the'} ${useCase.name} ${t('useCases.detail.outcome.default2') || 'sector typically see an increase in booked meetings within the first month of implementing Makinari. Our platform handles the repetitive prospecting work, allowing your team to focus on building relationships and closing.'}`}
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-6">
          <div className="p-6 rounded-2xl dark:neu-base neu-base-light border dark:border-white/5 border-black/5 shadow-sm">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('useCases.detail.implementation') || 'Implementation Details'}</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('useCases.detail.model') || 'Model'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{t(`useCases.categories.${(useCase.category || '').toLowerCase().replace(' & ', '')}.title`) || useCase.category}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('useCases.detail.timeToValue') || 'Time to Value'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{useCase.timeToValue || (t('useCases.detail.timeToValue.default') || "Under 2 weeks")}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('useCases.detail.supported') || 'Supported'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{t('useCases.detail.allPlans') || 'All Plans'}</span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t dark:border-white/5 border-black/5">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3">{t('useCases.detail.questions') || 'Questions?'}</h4>
              <Link href="#" className={`flex items-center text-sm font-medium transition-colors ${theme.textAccent} ${theme.hoverText}`}>
                {t('useCases.detail.talkToExpert') || 'Talk to an industry expert'}
                <ArrowRight size={14} className="ml-1" />
              </Link>
            </div>
          </div>

          {/* Related Features Panel */}
          {relatedFeatures.length > 0 && (
            <div className="p-6 rounded-2xl dark:neu-base neu-base-light border dark:border-white/5 border-black/5 shadow-sm">
              <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('useCases.detail.relatedFeatures') || 'Related Features'}</h3>
              <div className="flex flex-col gap-4">
                {relatedFeatures.map(feature => (
                  <Link href={`/product/features#${feature.id}`} key={feature.id} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-slate-50 dark:bg-black/50 flex items-center justify-center shadow-sm flex-shrink-0">
                      {React.cloneElement(feature.icon as React.ReactElement, { className: `w-5 h-5 ${theme.textAccent}` })}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {t(`features.sections.${feature.stage}.f${features.findIndex(f => f.id === feature.id) + 1}`) || feature.name}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1">{feature.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Supported Integrations Panel */}
          {relatedIntegrations.length > 0 && (
            <div className="p-6 rounded-2xl dark:neu-base neu-base-light border dark:border-white/5 border-black/5 shadow-sm">
              <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('useCases.detail.keyIntegrations') || 'Key Integrations'}</h3>
              <div className="flex flex-col gap-4">
                {relatedIntegrations.map(integration => (
                  <Link href={`/product/integrations/${integration.id}`} key={integration.id} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-slate-50 dark:bg-black/50 flex items-center justify-center shadow-sm flex-shrink-0">
                      {React.cloneElement(integration.icon as React.ReactElement, { className: "w-5 h-5" })}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {integration.name}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1">{t(`integrations.categories.${(integration.category || '').toLowerCase().replace(' & ', '')}`) || integration.category}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Agents Panel */}
          {relatedAgents.length > 0 && (
            <div className="p-6 rounded-2xl dark:neu-base neu-base-light border dark:border-white/5 border-black/5 shadow-sm">
              <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('useCases.detail.recommendedAgents') || 'Recommended Agents'}</h3>
              <div className="flex flex-col gap-4">
                {relatedAgents.map(agent => {
                  return (
                    <Link href={`/product/agents/${agent.id}`} key={agent.id} className="flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-full dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-slate-50 dark:bg-black/50 shadow-sm overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                         {/* Fallback avatar if no image or icon provided */}
                         <span className="text-xs font-bold text-slate-500">{agent.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {t(`openclaw.agent.${agent.id.replace('mkn1', 'strategy').replace('mkn2', 'growth').replace('mkn4', 'marketing').replace('mkn7', 'scraping').replace('mkn6', 'data')}.name`) || agent.name}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1">{agent.role}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
