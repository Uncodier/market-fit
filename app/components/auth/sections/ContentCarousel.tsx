"use client"

import * as React from "react";
import { useRef } from "react";
import { useLocalization } from "@/app/context/LocalizationContext";

function TiltCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate rotation (-15 to 15 degrees)
    const xPct = x / rect.width;
    const yPct = y / rect.height;
    const rotateX = (0.5 - yPct) * 30; // max 15 deg
    const rotateY = (xPct - 0.5) * 30; // max 15 deg

    ref.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    ref.current.style.transition = 'transform 0.1s ease-out';
    ref.current.style.zIndex = '50';
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    ref.current.style.transition = 'transform 0.5s ease';
    ref.current.style.zIndex = '1';
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', transition: 'transform 0.5s ease' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

export function ContentCarousel({ showBuilders = true }: { showBuilders?: boolean } = {}) {
  const { t } = useLocalization();
  
  return (
    <div className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.05),transparent_60%)]"></div>
      
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 mb-12 flex flex-col items-center text-center">
        <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 transition-transform hover:scale-105 duration-300">
          <span className="w-2 h-2 rounded-full bg-pink-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.8)]"></span>
          Content AI
        </div>
        
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight drop-shadow-lg">
          {t('landing.content.title.start') || 'Automatic content'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">{t('landing.content.title.highlight') || 'generation'}</span>
        </h2>
        
        <p className="dark:text-white/50 text-slate-500 leading-relaxed text-lg max-w-3xl mx-auto font-light mb-4">
          {t('landing.content.subtitle') || 'Create highly engaging videos, social posts, and personalized emails on autopilot. Consistent, on-brand content for every channel.'}
        </p>
        
        {showBuilders && (
        <div className="flex flex-col items-center mt-12 p-8 rounded-2xl dark:bg-white/[0.02] bg-black/5 border dark:border-white/5 border-black/5 w-full max-w-4xl relative z-10">
          <p className="text-sm font-semibold tracking-wider uppercase mb-4 dark:text-white/60 text-slate-500">
            {t('landing.content.builders') || 'Deploy anywhere'}
          </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2 dark:bg-[#121214] bg-white px-5 py-2.5 rounded-xl border dark:border-white/10 border-black/10 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-default">
              <svg className="w-5 h-5 text-[#21759b]" viewBox="0 0 24 24" fill="currentColor"><path d="M12.158 12.786l-2.698 7.84c.806.236 1.664.365 2.54.365 1.047 0 2.051-.18 2.986-.51-.024-.037-.046-.078-.065-.123l-2.763-7.572zm4.332-6.524c-1.353-.306-2.528-.475-3.096-.514l-1.636 4.706 5.86-1.574c-.266-.889-.661-1.74-1.128-2.618zm1.066 3.125l-7.058 1.895 2.903 7.955c2.449-1.396 4.145-3.896 4.545-6.845-.164-.813-.264-1.928-.39-3.005zm-11.233.151l2.502 7.189c-1.594-1.282-2.783-3.04-3.327-5.074.457.086 1.002.164 1.547.164.717 0 1.258-.093 1.765-.246l-2.487-2.033zm2.656-5.835c-1.235.34-2.352.92-3.298 1.693l3.65 2.984c1.192-.375 2.275-.818 2.651-1.025l-3.003-3.652zm-8.979 8.297c0 5.523 4.477 10 10 10 5.522 0 10-4.477 10-10s-4.478-10-10-10c-5.523 0-10 4.477-10 10zm10 9.167c-5.056 0-9.167-4.111-9.167-9.167 0-5.055 4.111-9.167 9.167-9.167 5.055 0 9.167 4.112 9.167 9.167 0 5.056-4.112 9.167-9.167 9.167z"/></svg>
              <span className="font-semibold dark:text-white text-slate-800 text-sm">WordPress</span>
            </div>
            <div className="flex items-center gap-2 dark:bg-[#121214] bg-white px-5 py-2.5 rounded-xl border dark:border-white/10 border-black/10 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-default">
              <svg className="w-5 h-5 text-[#4353ff]" viewBox="0 0 24 24" fill="currentColor"><path d="M18.8 3H5.2A2.2 2.2 0 0 0 3 5.2v13.6A2.2 2.2 0 0 0 5.2 21h13.6A2.2 2.2 0 0 0 21 18.8V5.2A2.2 2.2 0 0 0 18.8 3zm-2.7 12.3l-3.2-5v3.6c0 .5-.4.9-.9.9s-.9-.4-.9-.9V8l3.2 5V9.4c0-.5.4-.9.9-.9s.9.4.9.9v5.9zM8.3 14c-.5 0-.9-.4-.9-.9V8.4c0-.5.4-.9.9-.9s.9.4.9.9v4.7c0 .5-.4.9-.9.9z"/></svg>
              <span className="font-semibold dark:text-white text-slate-800 text-sm">Webflow</span>
            </div>
            <div className="flex items-center gap-2 dark:bg-[#121214] bg-white px-5 py-2.5 rounded-xl border dark:border-white/10 border-black/10 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-default">
              <svg className="w-5 h-5 text-[#95bf47]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.2 12.3c-.6-.7-1.4-1.3-2.3-1.6l-6.1-2.2c-.4-.1-.7-.3-.8-.7s.1-.8.5-.9l6.3-2.1c.3-.1.4-.4.3-.7s-.4-.4-.7-.3l-6.3 2.1c-.9.3-1.6 1.1-1.7 2.1 0 .9.6 1.7 1.4 2l6.1 2.2c.5.2.8.6.8 1 0 .5-.3.9-.8 1l-6.6 2.3c-.3.1-.5.4-.4.7.1.3.4.4.7.3l6.6-2.3c1-.3 1.7-1.2 1.7-2.2 0-.3 0-.6-.1-.9z"/><path d="M12.9 20c-.3.1-.5.4-.4.7.1.3.4.5.7.4l2.1-.7c.3-.1.5-.4.4-.7-.1-.3-.4-.5-.7-.4l-2.1.7z"/><path d="M3.7 13.9c-.3.1-.5.4-.4.7s.4.5.7.4l6.3-2.2c1.3-.4 2.1-1.7 1.7-3.1-.4-1.3-1.7-2.1-3.1-1.7l-6.3 2.2c-.3.1-.5.4-.4.7.1.3.4.5.7.4L9.2 9c.7-.2 1.5.1 1.8.8.2.7-.1 1.5-.8 1.8l-6.5 2.3z"/><path d="M6.5 16.9c-.3.1-.5.4-.4.7.1.3.4.5.7.4L9 17.2c.3-.1.5-.4.4-.7-.1-.3-.4-.5-.7-.4l-2.2.8z"/></svg>
              <span className="font-semibold dark:text-white text-slate-800 text-sm">Shopify</span>
            </div>
            <div className="flex items-center gap-2 dark:bg-[#121214] bg-white px-5 py-2.5 rounded-xl border dark:border-white/10 border-black/10 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-default">
              <svg className="w-5 h-5 text-black dark:text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l12 12-12 12V16H0V8h12V0z"/></svg>
              <span className="font-semibold dark:text-white text-slate-800 text-sm">Framer</span>
            </div>
            <div className="flex items-center gap-2 dark:bg-[#121214] bg-white px-5 py-2.5 rounded-xl border dark:border-white/10 border-black/10 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-default">
              <svg className="w-5 h-5 text-[#ff7a59]" viewBox="0 0 24 24" fill="currentColor"><path d="M10.198 13.68c-.68 1.055-1.921 1.637-3.193 1.637-2.14 0-3.882-1.742-3.882-3.883 0-2.14 1.742-3.882 3.882-3.882 1.258 0 2.493.574 3.178 1.614l7.618-3.921c-.08-.415-.121-.84-.121-1.27C17.68 1.848 19.529 0 21.655 0c2.127 0 3.975 1.848 3.975 3.975s-1.848 3.975-3.975 3.975c-.83 0-1.6-.263-2.234-.712L12.016 11.02c.071.32.109.654.109.996 0 .445-.054.877-.156 1.293l7.304 3.737c.664-.475 1.474-.756 2.348-.756 2.127 0 3.975 1.848 3.975 3.975 0 2.127-1.848 3.975-3.975 3.975s-3.975-1.848-3.975-3.975c0-.422.067-.828.188-1.215L10.198 13.68zM7.005 9.043c-1.321 0-2.392 1.07-2.392 2.391 0 1.32 1.071 2.392 2.392 2.392 1.32 0 2.391-1.072 2.391-2.392 0-1.321-1.071-2.391-2.391-2.391zM21.655 1.49c-1.304 0-2.363 1.06-2.363 2.364s1.059 2.364 2.363 2.364c1.305 0 2.364-1.06 2.364-2.364S22.96 1.49 21.655 1.49zm0 15.658c-1.304 0-2.363 1.061-2.363 2.364 0 1.305 1.059 2.364 2.363 2.364 1.305 0 2.364-1.059 2.364-2.364 0-1.303-1.059-2.364-2.364-2.364z"/></svg>
              <span className="font-semibold dark:text-white text-slate-800 text-sm">HubSpot</span>
            </div>
          </div>
          <p className="text-xs dark:text-white/40 text-slate-500 mt-4 text-center">
            {t('landing.content.builders.desc') || 'Deploy your optimized content instantly to the world\'s leading web builders with one click.'}
          </p>
        </div>
        )}
      </div>
      
      <div className="relative z-10 w-full overflow-hidden flex items-center py-4 mt-8 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] md:[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
        <div className="flex w-max animate-scroll-x gap-8 pr-8 hover:[animation-play-state:paused] py-8">
        {[1, 2, 3, 4].map((set) => (
          <React.Fragment key={set}>
            {/* Video Card */}
            <TiltCard className="w-[480px] h-[270px] flex-shrink-0 rounded-lg dark:neu-panel neu-panel-light p-2 flex flex-col group/card transition-colors cursor-pointer relative overflow-hidden">
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 dark:neu-pressed neu-pressed-light px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
                <span className="text-xs font-semibold dark:text-white/90 text-slate-500">AI Video</span>
              </div>
              
              <div className="w-full h-full rounded-md dark:neu-pressed neu-pressed-light overflow-hidden relative transition-colors flex flex-col">
                <div className="flex-1 relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.15),transparent_70%)]"></div>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-16 h-16 rounded-full dark:neu-button neu-button-light flex items-center justify-center group-hover/card:scale-110 transition-transform">
                      <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-pink-400 border-b-[8px] border-b-transparent ml-1"></div>
                    </div>
                  </div>
                </div>
                <div className="h-10 dark:neu-pressed neu-pressed-light px-4 flex items-center gap-3 border-t-0">
                  <div className="w-3 h-3 dark:text-white/50 text-slate-500">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  <div className="flex-1 h-1.5 dark:bg-white/10 bg-black/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-pink-600 to-pink-400 w-1/3 relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_10px_rgba(236,72,153,0.8)]"></div>
                    </div>
                  </div>
                  <div className="text-[10px] dark:text-white/50 text-slate-500 font-mono">0:45 / 2:30</div>
                </div>
              </div>
            </TiltCard>

            {/* Social Post Card */}
            <TiltCard className="w-[300px] h-[380px] flex-shrink-0 self-center rounded-lg dark:neu-panel neu-panel-light p-5 flex flex-col group/card transition-colors cursor-pointer relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 p-[2px]">
                    <div className="w-full h-full dark:bg-[#121214] bg-white rounded-full border dark:border-white/10 border-black/10"></div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold dark:text-white/90 text-slate-500">Makinari AI</div>
                    <div className="text-[10px] dark:text-white/40 text-slate-500">Just now • 🌐</div>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="h-2 w-full dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                <div className="h-2 w-[90%] dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                <div className="h-2 w-[60%] dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
              </div>

              <div className="flex gap-2 mb-4">
                <span className="text-blue-400 text-xs">#AI</span>
                <span className="text-blue-400 text-xs">#Growth</span>
              </div>

              <div className="w-full flex-1 rounded-md dark:neu-pressed neu-pressed-light overflow-hidden relative transition-colors">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.15),transparent_70%)]"></div>
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-blue-500/20 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 h-16 border-b border-l dark:border-white/10 border-black/10">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,100 L20,80 L40,90 L60,40 L80,50 L100,10" fill="none" stroke="#60a5fa" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
                  </svg>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t dark:border-white/5 border-black/5 dark:text-white/40 text-slate-500">
                <div className="w-4 h-4 rounded-full border dark:border-white/20 border-black/20"></div>
                <div className="w-4 h-4 rounded-full border dark:border-white/20 border-black/20"></div>
                <div className="w-4 h-4 rounded-full border dark:border-white/20 border-black/20"></div>
                <div className="w-4 h-4 rounded-full border dark:border-white/20 border-black/20"></div>
              </div>
            </TiltCard>

            {/* Email Card */}
            <TiltCard className="w-[400px] h-[300px] flex-shrink-0 self-center rounded-lg dark:neu-panel neu-panel-light flex flex-col group/card transition-colors cursor-pointer overflow-hidden relative">
              <div className="dark:neu-pressed neu-pressed-light p-4 border-b dark:border-white/5 border-black/5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <div className="text-xs dark:text-white/50 text-slate-500">New Message</div>
                      <div className="text-sm font-semibold dark:text-white/90 text-slate-500">Cold Email</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2 border-b dark:border-white/5 border-black/5 pb-2">
                    <span className="dark:text-white/40 text-slate-500 w-8">To:</span>
                    <span className="dark:text-white/80 text-slate-500 dark:bg-white/5 bg-black/5 px-2 rounded">sarah@company.com</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="dark:text-white/40 text-slate-500 w-8">Subj:</span>
                    <span className="dark:text-white/90 text-slate-500 font-medium">Quick question about your CRM...</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_60%)]"></div>
                <div className="relative z-10 space-y-4">
                  <div className="h-2 w-1/4 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-2 w-full dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                    <div className="h-2 w-[95%] dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                    <div className="h-2 w-[85%] dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-2 w-full dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                    <div className="h-2 w-[90%] dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                  </div>
                  <div className="mt-4 w-32 h-8 rounded-md dark:neu-button neu-button-light"></div>
                </div>
              </div>
            </TiltCard>
          </React.Fragment>
        ))}
      </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scroll-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 4)); }
        }
        .animate-scroll-x { animation: scroll-x 40s linear infinite; }
      `}} />
    </div>
  );
}
