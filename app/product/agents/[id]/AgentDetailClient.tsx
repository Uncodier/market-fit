"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { ChevronLeft, CheckCircle2, ArrowRight } from "@/app/components/ui/icons"
import * as Icons from "@/app/components/ui/icons"
import Link from "next/link"
import { Agent, AgentActivity } from "@/app/types/agents"
import { useLocalization } from "@/app/context/LocalizationContext"

export function AgentDetailClient({ agent }: { agent: Agent }) {
  const { t } = useLocalization()
  
  const getTranslatedType = (type: string) => {
    const key = `agents.type.${type}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };

  const getTranslatedStatus = (status: string) => {
    const key = `agents.status.${status}`;
    const translated = t(key);
    return translated === key ? status.replace('_', ' ') : translated;
  };
  
  // Reuse the color mapping logic from AgentsClient
  const getIconColor = (categoryId: string) => {
    switch (categoryId) {
      case 'marketing': return {
        bgBlur: "bg-orange-500/10 dark:bg-orange-500/5",
        btnPrimary: "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]",
        textAccent: "text-orange-600 dark:text-orange-400",
        bgAccent: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
        checkColor: "text-orange-500",
        hoverText: "hover:text-orange-700 dark:hover:text-orange-300",
        iconColor: "text-[#F97316]"
      };
      case 'sales': return {
        bgBlur: "bg-blue-500/10 dark:bg-blue-500/5",
        btnPrimary: "bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]",
        textAccent: "text-blue-600 dark:text-blue-400",
        bgAccent: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
        checkColor: "text-blue-500",
        hoverText: "hover:text-blue-700 dark:hover:text-blue-300",
        iconColor: "text-[#3B82F6]"
      };
      case 'product': return {
        bgBlur: "bg-emerald-500/10 dark:bg-emerald-500/5",
        btnPrimary: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]",
        textAccent: "text-emerald-600 dark:text-emerald-400",
        bgAccent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
        checkColor: "text-emerald-500",
        hoverText: "hover:text-emerald-700 dark:hover:text-emerald-300",
        iconColor: "text-[#10B981]"
      };
      case 'management': return {
        bgBlur: "bg-violet-500/10 dark:bg-violet-500/5",
        btnPrimary: "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]",
        textAccent: "text-violet-600 dark:text-violet-400",
        bgAccent: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
        checkColor: "text-violet-500",
        hoverText: "hover:text-violet-700 dark:hover:text-violet-300",
        iconColor: "text-[#8B5CF6]"
      };
      default: return {
        bgBlur: "bg-slate-500/10 dark:bg-slate-500/5",
        btnPrimary: "bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white shadow-[0_0_20px_rgba(148,163,184,0.3)]",
        textAccent: "text-slate-600 dark:text-slate-400",
        bgAccent: "bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200 dark:border-slate-500/20",
        checkColor: "text-slate-500",
        hoverText: "hover:text-slate-700 dark:hover:text-slate-300",
        iconColor: "text-slate-500"
      };
    }
  };

  const theme = getIconColor(agent.type || 'other');
  const IconComponent = Icons[agent.icon as keyof typeof Icons] || Icons.Zap;
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] ${theme.bgBlur} rounded-full blur-[100px] opacity-100 pointer-events-none`}></div>
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-12">
          <Link href="/product/agents" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8 transition-colors">
            <ChevronLeft size={16} className="mr-1" />
            {t('common.backTo') || 'Back to '} {t('common.agents') || 'Agents'}
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className={`w-24 h-24 rounded-2xl bg-slate-50 dark:bg-[#0f0f13] border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg p-4 flex-shrink-0 ${theme.iconColor}`}>
              <IconComponent className="w-12 h-12" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {agent.name}
                </h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${theme.bgAccent}`}>
                  {agent.role || agent.name}
                </span>
              </div>
              <div className={`font-medium mb-4 flex items-center gap-2 ${theme.textAccent}`}>
                <span className="font-semibold uppercase tracking-wider text-xs px-2 py-0.5 rounded border border-current">{getTranslatedType(agent.type)}</span>
              </div>
              <p className="text-lg md:text-xl dark:text-white/60 text-slate-500 max-w-2xl font-light leading-relaxed">
                {agent.description}
              </p>
            </div>
            
            <div className="w-full md:w-auto mt-4 md:mt-0 flex flex-col sm:flex-row md:flex-col gap-3">
              <Link 
                href="/auth?mode=register"
                className={`px-8 py-3.5 rounded-full font-inter font-bold transition-all shadow-sm flex items-center justify-center gap-2 group ${theme.btnPrimary}`}
              >
                {t('common.getStarted') || 'Start with Makinari'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a 
                href="https://docs.makinari.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center"
              >
                {t('common.viewDocumentation') || 'Read Docs'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 max-w-5xl mx-auto px-6 lg:px-12 w-full flex-1 flex flex-col md:flex-row gap-12">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{t('agents.detail.about') || 'About this Agent'}</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
            <p>
              {(t('agents.detail.description.template') || 'The {name} agent specializes in {type} tasks. Designed to help revenue teams work more efficiently, this agent integrates seamlessly with the rest of the Makinari workforce to create a unified workflow from end to end.')
                .replace('{name}', agent.name)
                .replace('{type}', getTranslatedType(agent.type).toLowerCase())}
            </p>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">{t('agents.detail.capabilities') || 'Key Capabilities'}</h3>
            {agent.activities && agent.activities.length > 0 ? (
              <ul className="space-y-4 mb-8 list-none pl-0">
                {agent.activities.map((activity) => (
                  <li key={activity.id} className="flex items-start bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5">
                    <CheckCircle2 size={24} className={`${theme.checkColor} mr-4 mt-1 flex-shrink-0`} />
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">{activity.name}</h4>
                      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed m-0">
                        {activity.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 italic">{t('agents.detail.noActivities') || 'No specific activities listed.'}</p>
            )}
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">{t('agents.detail.whyMatters') || 'Why it matters'}</h3>
            <p className="text-slate-600 dark:text-slate-300">
              {(t('agents.detail.whyMatters.template') || 'When using the {name} agent, teams typically see a significant reduction in manual work and a corresponding increase in output. By keeping this functionality natively within Makinari, you eliminate the need for third-party point solutions and complicated API integrations.')
                .replace('{name}', agent.name)}
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-80 flex-shrink-0">
          <div className="p-6 rounded-2xl dark:bg-[#0f0f13] bg-slate-50 border dark:border-white/5 border-black/5">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('agents.detail.specs') || 'Agent Specifications'}</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('agents.detail.category') || 'Category'}</span>
                <span className="font-medium capitalize text-slate-900 dark:text-white">{getTranslatedType(agent.type)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('agents.detail.successRate') || 'Success Rate'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{agent.successRate}%</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('agents.detail.conversations') || 'Conversations'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{(agent.conversations || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">{t('agents.detail.status') || 'Status'}</span>
                <span className="font-medium capitalize text-slate-900 dark:text-white">{getTranslatedStatus(agent.status)}</span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t dark:border-white/5 border-black/5">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3">{t('agents.detail.learnMore') || 'Learn More'}</h4>
              <Link href="/product/openclaw" className={`flex items-center text-sm font-medium transition-colors ${theme.textAccent} ${theme.hoverText}`}>
                {t('agents.detail.aboutArchitecture') || 'About OpenClaw Architecture'}
                <ArrowRight size={14} className="ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
