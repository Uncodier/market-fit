"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/app/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { X, ChevronRight, Check } from "@/app/components/ui/icons";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { steps } from "./constants/tour-constants";

export function GuidedTour() {
  const { user } = useAuth();
  
  // Como isVisible se maneja desde adentro, siempre pasamos el layout shell si estamos logueados o navegando
  // Removimos la validación estricta a user {user && <GuidedTourContent user={user} />} porque hay vistas 
  // (como navegación) que pueden cargar searchParams antes que el auth context retorne user.
  
  return (
    <Suspense fallback={null}>
      <GuidedTourContent user={user} />
    </Suspense>
  );
}

function GuidedTourContent({ user }: { user: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStepIndexRef = useRef(currentStepIndex);
  const processedStepRef = useRef<number | null>(null);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const currentStep = steps[currentStepIndex];

  // 1. Declarar callbacks primero, en orden de dependencias.
  
  const updateTargetRect = useCallback((index?: number, shouldScroll = false) => {
    const activeIndex = index !== undefined ? index : currentStepIndexRef.current;
    const stepLocal = steps[activeIndex];
    if (!stepLocal) return;
    const element = document.querySelector(stepLocal.selector);
    
    if (element) {
      if (shouldScroll) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      setTargetRect(element.getBoundingClientRect());
    } else {
      setTargetRect(null); // Explicitamente nulo cuando no existe en DOM
    }
  }, []);

  const checkAndStartTour = useCallback(() => {
    if (!user) return false;
    
    const firstTargetExists = document.querySelector(steps[0].selector) !== null;

    if (!user.user_metadata?.has_completed_tour && firstTargetExists) {
      setIsVisible(true);
      if (steps[0].path) {
        router.push(steps[0].path);
      }
      updateTargetRect(0, true);
      return true;
    }
    return false;
  }, [user, updateTargetRect, router]);

  const completeTour = useCallback(async () => {
    setIsVisible(false);
    
    // Limpiar persistencia en URL
    if (typeof window !== 'undefined') {
      const currentSearchParams = new URLSearchParams(searchParams?.toString() || window.location.search);
      if (currentSearchParams.has("showTour") || currentSearchParams.has("step") || currentSearchParams.has("tour")) {
        currentSearchParams.delete("showTour");
        currentSearchParams.delete("step");
        currentSearchParams.delete("tour");
        const queryStr = currentSearchParams.toString();
        router.replace(`${pathname}${queryStr ? `?${queryStr}` : ''}`, { scroll: false });
      }
    }

    if (user && !user.user_metadata?.has_completed_tour) {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { has_completed_tour: true },
      });
    }
    window.dispatchEvent(new CustomEvent("tour:completed"));
  }, [user, router, searchParams, pathname]);

  const buildTourUrl = useCallback((basePath: string, stepIndex: number) => {
    const [pathPart, queryPart] = basePath.split('?');
    const newParams = new URLSearchParams(queryPart || "");
    
    // If there were existing search parameters in the original URL (not the basePath), we should preserve them?
    // Actually the original code just parsed the basePath query string:
    // const originalParams = new URLSearchParams(queryPart);
    // originalParams.forEach((val, key) => url.searchParams.set(key, val));
    
    newParams.set("showTour", "true");
    newParams.set("step", stepIndex.toString());
    
    // Ensure path starts with /
    const cleanPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    return `${cleanPath}?${newParams.toString()}`;
  }, []);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      const prevStep = steps[prevIndex];
      const currentStep = steps[currentStepIndex];

      setCurrentStepIndex(prevIndex);
      setTargetRect(null); // hide spotlight momentarily while navigating
      
      const newUrl = buildTourUrl(prevStep.path || pathname, prevIndex);

      if (prevStep.path && currentStep.path !== prevStep.path) {
        router.push(newUrl, { scroll: false });
      } else {
        router.replace(newUrl, { scroll: false });
      }
    }
  }, [currentStepIndex, pathname, buildTourUrl, router]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const nextStep = steps[nextIndex];
      const currentStep = steps[currentStepIndex];
      
      setCurrentStepIndex(nextIndex);
      setTargetRect(null); // hide spotlight momentarily while navigating
      
      const newUrl = buildTourUrl(nextStep.path || pathname, nextIndex);
      
      if (nextStep.path && currentStep.path !== nextStep.path) {
        router.push(newUrl, { scroll: false });
      } else {
        router.replace(newUrl, { scroll: false });
      }
    } else {
      completeTour();
    }
  }, [currentStepIndex, pathname, buildTourUrl, router, completeTour]);

  const handleSkip = useCallback(() => {
    completeTour();
  }, [completeTour]);

  // 2. Declarar effects después de TODOS los callbacks

  useEffect(() => {
    setMounted(true);
  }, []);

  // Autoiniciar o Continuar basándonos en searchParams nativos de Next
  useEffect(() => {
    if (!mounted) return;
    let initInterval: NodeJS.Timeout | null = null;

    const tourParam = searchParams?.get("tour") || new URLSearchParams(window.location.search).get("tour");
    const showTourParam = searchParams?.get("showTour") || new URLSearchParams(window.location.search).get("showTour");
    const stepParamRaw = searchParams?.get("step") || new URLSearchParams(window.location.search).get("step");
    
    if (tourParam === "start") {
      const targetUrl = buildTourUrl(steps[0].path || pathname, 0);
      const targetPath = steps[0].path ? steps[0].path.split('?')[0] : pathname;
      
      if (pathname !== targetPath) {
         router.push(targetUrl);
      } else {
         router.replace(targetUrl, { scroll: false });
      }
      return;
    } 
    
    if (tourParam === "continue" || showTourParam === "true") {
      const stepParam = parseInt(stepParamRaw || "0", 10);
      
      if (processedStepRef.current === stepParam) return;
      processedStepRef.current = stepParam;
      
      // Cleanup 'tour' param if it exists
      if (tourParam) {
        const currentParams = new URLSearchParams(searchParams?.toString() || window.location.search);
        currentParams.delete("tour");
        currentParams.set("showTour", "true");
        currentParams.set("step", stepParam.toString());
        router.replace(`${pathname}?${currentParams.toString()}`, { scroll: false });
      }

      setCurrentStepIndex(stepParam);
      setIsVisible(true);

      let attempts = 0;
      initInterval = setInterval(() => {
        attempts++;
        const target = document.querySelector(steps[stepParam]?.selector);
        if (target) {
          if (initInterval) clearInterval(initInterval);
          updateTargetRect(stepParam, true); // true para forzar scroll
        } else if (attempts > 40) { // Max 4 seconds
          if (initInterval) clearInterval(initInterval);
          updateTargetRect(stepParam);
        }
      }, 100);
    } else {
      processedStepRef.current = null;
    }
    
    return () => {
      if (initInterval) clearInterval(initInterval);
    };
  }, [mounted, searchParams, updateTargetRect, router, pathname, buildTourUrl]);
  
  useEffect(() => {
    // Escuchar evento global
    const handleGlobalStartEvent = () => {
      console.log("GuidedTour: Evento tour:start recibido");
      const targetUrl = buildTourUrl(steps[0].path || window.location.pathname, 0);
      const targetPath = steps[0].path ? steps[0].path.split('?')[0] : window.location.pathname;
      
      if (window.location.pathname !== targetPath) {
        router.push(targetUrl);
      } else {
        router.replace(targetUrl, { scroll: false });
      }
    };
    
    window.addEventListener("tour:start", handleGlobalStartEvent);
    
    return () => {
      window.removeEventListener("tour:start", handleGlobalStartEvent);
    };
  }, [router, buildTourUrl]);

  useEffect(() => {
    if (!mounted) return;
    
    let observer: MutationObserver | null = null;
    let fallbackTimeout: NodeJS.Timeout | null = null;

    const checkTimer = setTimeout(() => {
      // Solo hacer el autocheck estricto si tenemos usuario
      if (user && !checkAndStartTour() && user.user_metadata?.has_completed_tour !== true) {
        observer = new MutationObserver(() => {
          if (checkAndStartTour()) {
            observer?.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        fallbackTimeout = setTimeout(() => {
          observer?.disconnect();
        }, 10000);
      }
    }, 1000);

    return () => {
      clearTimeout(checkTimer);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (observer) observer.disconnect();
    };
  }, [mounted, user, checkAndStartTour]);

  useEffect(() => {
    if (!isVisible) return;

    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    const interval = setInterval(() => updateTargetRect(), 200);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
      clearInterval(interval);
    };
  }, [isVisible, updateTargetRect]);

  // 3. Render
  if (!mounted) {
     return null;
  }
  
  if (!isVisible || !currentStep) {
     return null;
  }

  // Si targetRect está nulo mientras está visible (cambio de pantalla), mostramos el popup temporalmente en el centro
  // mientras el interval encuentra el target, sin desmontar el estado
  const safeTargetRect = targetRect || {
    top: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    left: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    width: 0,
    height: 0,
    right: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    bottom: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    toJSON: function() { return this; }
  } as DOMRect;

  const isTooCloseToRight = safeTargetRect.right + 360 > window.innerWidth;
  const style = {
    top: `${Math.max(20, safeTargetRect.top + safeTargetRect.height / 2 - 100)}px`,
    left: isTooCloseToRight
      ? `${Math.max(20, safeTargetRect.left - 360)}px`
      : `${Math.min(window.innerWidth - 360, safeTargetRect.right + 24)}px`,
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Backdrop for clicks only */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={handleSkip}
      />

      {/* Target Highlight (Spotlight) */}
      <div
        className={cn(
          "absolute rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none transition-all duration-500 ease-in-out",
          !targetRect && "opacity-0" // Ocultar spotlight si no hay target real pero mantener el backdrop y popup
        )}
        style={{
          top: safeTargetRect.top - 8,
          left: safeTargetRect.left - 8,
          width: safeTargetRect.width + 16,
          height: safeTargetRect.height + 16,
        }}
      >
        <div className="absolute inset-0 rounded-lg border-2 border-primary/50" />
        <div className="absolute inset-0 rounded-lg border-2 border-primary animate-ping opacity-20" />
      </div>

      {/* Popover */}
      <div
        className={cn(
          "absolute w-[340px] bg-background rounded-xl shadow-2xl border border-border pointer-events-auto transition-all duration-500 ease-in-out",
          "p-0 flex flex-col overflow-hidden animate-in fade-in zoom-in-95",
        )}
        style={style}
      >
        <div key={currentStep.id} className="flex flex-col h-full w-full animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="bg-muted/40 p-4 pb-3 border-b border-border/40 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="text-lg">{currentStep.icon}</span>
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              {currentStep.title}
            </h3>
          </div>
          <button
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {currentStep.content}
          </p>
        </div>

        <div className={cn("px-4 pb-4 flex items-center mt-1", currentStepIndex === steps.length - 1 ? "justify-end" : "justify-between")}>
          {currentStepIndex !== steps.length - 1 && (
            <div className="flex gap-1.5 items-center">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    idx === currentStepIndex ? "bg-primary w-4" : "bg-primary/20 w-1.5",
                  )}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {currentStepIndex !== steps.length - 1 && (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="h-8 text-[11px] px-2 text-muted-foreground hover:text-foreground">
                Skip
              </Button>
            )}
              {currentStepIndex > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="h-8 text-[11px] px-2.5 font-medium text-muted-foreground hover:text-foreground"
                >
                  Back
                </Button>
              )}
              <Button
                variant={currentStepIndex === steps.length - 1 ? "default" : "outline"}
                size="sm"
                onClick={handleNext}
                className={cn("gap-1 h-8 text-[11px] px-2.5", currentStepIndex !== steps.length - 1 && "font-medium")}
              >
                {currentStepIndex === steps.length - 1 ? (
                  <>
                    Finish <Check className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    Next <ChevronRight className="w-3 h-3" />
                  </>
                )}
              </Button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}