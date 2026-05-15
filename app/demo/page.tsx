"use client";

import { availableDemos } from "@/lib/demo-data";
import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { useSearchParams } from "next/navigation";

function DemoSelectorContent() {
  const searchParams = useSearchParams();
  // Evaluamos en SSR y cliente si hay parámetros que causan redirección
  const isRedirectingParam = searchParams.has('client') || searchParams.has('lang') || searchParams.has('theme') || searchParams.has('page') || searchParams.has('accountId');
  
  const [currentDemo, setCurrentDemo] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(isRedirectingParam);


  useEffect(() => {
    setIsMounted(true);
    // Check if cookie exists
    const match = document.cookie.match(/market_fit_demo_site_id=([^;]+)/);
    if (match) {
      setCurrentDemo(match[1]);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const urlLang = searchParams.get('lang');
    const urlTheme = searchParams.get('theme');
    const urlPage = searchParams.get('page');
    const urlClient = searchParams.get('client');

    let shouldRedirect = false;

    if (urlLang) {
      document.cookie = `NEXT_LOCALE=${urlLang}; path=/; max-age=31536000`;
      document.cookie = `market_fit_lang=${urlLang}; path=/; max-age=31536000`;
      localStorage.setItem('lang', urlLang);
      shouldRedirect = true;
    }

    if (urlTheme) {
      localStorage.setItem('theme', urlTheme);
      // Disparamos un evento para que los listeners (como ThemeProvider) se actualicen
      window.dispatchEvent(new Event('storage'));
      shouldRedirect = true;
    }

    if (urlClient && availableDemos.some(d => d.id === urlClient)) {
      document.cookie = `market_fit_demo_site_id=${urlClient}; path=/; max-age=86400`;
      localStorage.setItem('currentSiteId', urlClient);
      localStorage.removeItem('market_fit_manual_demo');
      setCurrentDemo(urlClient);
      sessionStorage.setItem('preventAutoRefresh', 'true');
      shouldRedirect = true;
    }

    // Redirect to specified page or robots if requested
    if ((urlClient || urlLang || urlTheme || urlPage) && (shouldRedirect || urlPage)) {
      // Usar href para forzar recarga completa, ya que los cookies cambiaron y el contexto 
      // de supabase debe recargarse con el mock.
      window.location.href = urlPage || "/robots";
    } else if (urlClient || urlLang || urlTheme || urlPage) {
      setIsAutoRedirecting(false);
    }
  }, [isMounted, searchParams]);

  const selectDemo = (id: string) => {
    // Set cookie that lasts for 24 hours
    document.cookie = `market_fit_demo_site_id=${id}; path=/; max-age=86400`;
    localStorage.setItem('currentSiteId', id);
    localStorage.setItem('market_fit_manual_demo', 'true');
    setCurrentDemo(id);
    
    // Almacenamos un flag en sessionStorage para que el middleware/contextos no redireccionen en la recarga
    sessionStorage.setItem('preventAutoRefresh', 'true');
    
    // Force reload to apply changes everywhere (Supabase client will re-initialize)
    window.location.href = "/robots";
  };

  const disableDemo = () => {
    document.cookie = `market_fit_demo_site_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    localStorage.removeItem('currentSiteId');
    localStorage.removeItem('market_fit_manual_demo');
    setCurrentDemo(null);
    window.location.href = "/projects";
  };

  if (isAutoRedirecting) {
    return <div className="fixed inset-0 bg-background z-[9999]"></div>;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center mb-8">
        <div className="p-3 rounded-full bg-primary/10">
          <Image 
            src="/images/logo.png"
            alt="Market Fit Logo"
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
            priority
          />
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-8">
        <div>
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Demo Accounts</h2>
              <p className="text-muted-foreground text-sm mt-1">Explore platform features with sample data. No changes are saved permanently.</p>
            </div>
          </div>

          {currentDemo && (
            <Card className="border border-amber-200 bg-amber-50 hover:border-amber-300 transition-colors cursor-pointer mb-6" onClick={(e) => {
              e.stopPropagation();
              disableDemo();
            }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-md bg-amber-100 flex items-center justify-center text-amber-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-amber-900 truncate">Exit Demo Mode</h3>
                    <p className="text-sm text-amber-700/80 truncate">Return to your real projects and data</p>
                  </div>
                  <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={(e) => { 
                    e.stopPropagation(); 
                    disableDemo();
                  }}>Exit Demo</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {availableDemos.map((demo) => {
              const isSelected = currentDemo === demo.id;
              
              return (
                <Card 
                  key={demo.id} 
                  className={`border hover:border-foreground/20 transition-colors cursor-pointer ${
                    isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
                  }`}
                  onClick={() => selectDemo(demo.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                        <span className="text-sm font-medium">{demo.name?.charAt(0)?.toUpperCase() || "D"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{demo.name}</h3>
                          {isSelected && (
                            <Badge variant="secondary" className="h-5 px-2 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{demo.description || "Demo Account"}</p>
                      </div>
                      <Button 
                        variant={isSelected ? "default" : "secondary"} 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          selectDemo(demo.id); 
                        }}
                      >
                        {isSelected ? 'Selected' : 'Load Demo'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function DemoSelectorPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] w-full flex items-center justify-center p-6 relative">
      <Suspense fallback={<div className="fixed inset-0 bg-background z-[9999]"></div>}>
        <DemoSelectorContent />
      </Suspense>
    </div>
  );
}
