import type { Metadata, Viewport } from 'next'
import { Inter } from "next/font/google"
import "./globals.css"
import "./safari-fix.css"
import { Toaster } from "sonner"
import ClientWrapper from './client-wrapper'
import Script from 'next/script'
import Providers from "./providers/Providers"
import { shouldUseLayout } from './config/routes'
import LoggerInit from './components/LoggerInit'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'MAKINARI',
  description: 'Find your product market fit.',
}

// Configuración del viewport con ancho mínimo y escalado
export const viewport: Viewport = {
  initialScale: 0.9,
  minimumScale: 0.4,
  maximumScale: 1.2,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/logo.png" type="image/png" sizes="32x32" />
        <meta name="application-name" content="MAKINARI" />
        <meta name="apple-mobile-web-app-title" content="MAKINARI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/images/logo.png" />

        {process.env.NODE_ENV !== 'development' && (
          <Script 
            id="market-fit-tracking"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    // Helper function to safely observe elements
                    function safeObserve(observer, target, options) {
                      if (!target || !(target instanceof Node)) {
                        if (typeof console !== 'undefined' && console.warn) {
                          console.warn('MutationObserver: Cannot observe invalid target', target);
                        }
                        return false;
                      }
                      try {
                        observer.observe(target, options);
                        return true;
                      } catch (error) {
                        if (typeof console !== 'undefined' && console.error) {
                          console.error('MutationObserver: Error observing target', error);
                        }
                        return false;
                      }
                    }

                    window.MarketFit = window.MarketFit || {};
                    MarketFit.siteId = "9be0a6a2-5567-41bf-ad06-cb4014f0faf2";
                    
                    var script = document.createElement('script');
                    script.async = true;
                    script.src = 'https://files.uncodie.com/tracking.min.js';
                    
                    script.onload = function() {
                      try {
                        if (window.MarketFit && typeof window.MarketFit.init === 'function') {
                          // Detect theme function
                          function detectTheme() {
                            try {
                              const isDark = 
                                (document.documentElement && document.documentElement.classList.contains('dark')) ||
                                (document.body && document.body.classList.contains('dark')) ||
                                (document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark') ||
                                (document.body && document.body.getAttribute('data-theme') === 'dark') ||
                                (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
                              
                              return isDark ? 'dark' : 'default';
                            } catch (error) {
                              return 'default';
                            }
                          }
                          
                          // Initialize with detected theme
                          window.MarketFit.init({
                            siteId: "9be0a6a2-5567-41bf-ad06-cb4014f0faf2",
                            trackVisitors: true,
                            trackActions: true,
                            recordScreen: true,
                            debug: false,
                            theme: detectTheme(),
                            chat: {
                              enabled: true,
                              hidden: true,
                              allowAnonymousMessages: false,
                              position: "bottom-right",
                              title: "Customer and Tech Support",
                              welcomeMessage: "Welcome to Makret Fit! How can we assist you today?"
                            }
                          });
                          

                          
                          // Function to update theme after initialization
                          function updateWidgetTheme() {
                            try {
                              const currentTheme = detectTheme();
                              if (window.MarketFit && typeof window.MarketFit.setTheme === 'function') {
                                window.MarketFit.setTheme(currentTheme);
                              }
                            } catch (error) {
                              // Silently fail theme updates
                            }
                          }
                          
                          // Watch for theme changes with safe observation
                          try {
                            const observer = new MutationObserver(updateWidgetTheme);
                            
                            // Wait for DOM to be ready before observing
                            function setupThemeObserver() {
                              if (document.documentElement && document.body) {
                                safeObserve(observer, document.documentElement, { 
                                  attributes: true, 
                                  attributeFilter: ['class', 'data-theme'] 
                                });
                                safeObserve(observer, document.body, { 
                                  attributes: true, 
                                  attributeFilter: ['class', 'data-theme'] 
                                });
                              }
                            }
                            
                            if (document.readyState === 'loading') {
                              document.addEventListener('DOMContentLoaded', setupThemeObserver);
                            } else {
                              setupThemeObserver();
                            }
                            
                            // Listen for system theme changes
                            if (window.matchMedia) {
                              window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateWidgetTheme);
                            }
                          } catch (error) {
                            if (typeof console !== 'undefined' && console.error) {
                              console.error('MutationObserver: Error setting up theme observer', error);
                            }
                          }
                        }
                      } catch (error) {
                        if (typeof console !== 'undefined' && console.error) {
                          console.error('MarketFit: Error initializing tracking', error);
                        }
                      }
                    };
                    
                    script.onerror = function() {
                      if (typeof console !== 'undefined' && console.error) {
                        console.error('MarketFit: Failed to load tracking script');
                      }
                    };
                    
                    var firstScript = document.getElementsByTagName('script')[0];
                    if (firstScript && firstScript.parentNode) {
                      firstScript.parentNode.insertBefore(script, firstScript);
                    } else {
                      document.head.appendChild(script);
                    }
                  } catch (error) {
                    if (typeof console !== 'undefined' && console.error) {
                      console.error('MarketFit: Error in tracking script setup', error);
                    }
                  }
                })();
              `
            }}
          />
        )}

      </head>
      <body className={inter.className}>
        <Providers>
          <LoggerInit />
          <main className="min-h-screen bg-background overflow-visible">
            <ClientWrapper>
              {children}
            </ClientWrapper>
            <Toaster />
          </main>
        </Providers>
        
        
        <Script 
          id="safari-detection-and-fix"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Helper function to safely observe elements
                  function safeObserve(observer, target, options) {
                    if (!target || !(target instanceof Node)) {
                      if (typeof console !== 'undefined' && console.warn) {
                        console.warn('MutationObserver: Cannot observe invalid target', target);
                      }
                      return false;
                    }
                    try {
                      observer.observe(target, options);
                      return true;
                    } catch (error) {
                      if (typeof console !== 'undefined' && console.error) {
                        console.error('MutationObserver: Error observing target', error);
                      }
                      return false;
                    }
                  }

                  const isSafari = 
                    navigator.userAgent.match(/AppleWebKit\\/[\\d.]+/g) &&
                    navigator.userAgent.match(/Version\\/[\\d.]+.*Safari/) &&
                    !navigator.userAgent.match(/Chrome\\/[\\d.]+/g);
                  
                  if (isSafari) {
                    if (document.documentElement) {
                      document.documentElement.classList.add('safari');
                    }
                    
                    function fixSafariIcons() {
                      try {
                        if (!document || !document.querySelectorAll) {
                          return;
                        }

                        const selectors = [
                          'nav svg',
                          '[role="menuitem"] svg',
                          'input + div > svg',
                          'select + div > svg',
                          'button > svg',
                          '[class*="select-trigger"] svg',
                          '[class*="input"] svg',
                          'a:has(> svg) svg'
                        ];
                        
                        selectors.forEach(selector => {
                          try {
                            document.querySelectorAll(selector).forEach(svg => {
                              const parent = svg.parentElement;
                              if (parent) {
                                parent.classList.add('safari-icon-fix');
                              }
                            });
                          } catch (error) {
                            // Silently fail for individual selectors
                          }
                        });
                        
                        try {
                          document.querySelectorAll('[role="switch"]').forEach(switchEl => {
                            if (!switchEl || !(switchEl instanceof Node)) {
                              return;
                            }

                            const thumb = switchEl.querySelector('span') || switchEl.querySelector('[class*="thumb"]');
                            if (thumb) {
                              if (switchEl.getAttribute('data-state') === 'checked') {
                                thumb.style.marginLeft = '-20px';
                                thumb.style.transform = 'translateX(20px)';
                              } else {
                                thumb.style.marginLeft = '-20px';
                                thumb.style.transform = 'translateX(0)';
                              }
                              
                              try {
                                const observer = new MutationObserver((mutations) => {
                                  mutations.forEach((mutation) => {
                                    if (mutation.attributeName === 'data-state') {
                                      const state = switchEl.getAttribute('data-state');
                                      if (state === 'checked') {
                                        thumb.style.marginLeft = '-20px';
                                        thumb.style.transform = 'translateX(20px)';
                                      } else {
                                        thumb.style.marginLeft = '-20px';
                                        thumb.style.transform = 'translateX(0)';
                                      }
                                    }
                                  });
                                });
                                
                                safeObserve(observer, switchEl, { attributes: true });
                              } catch (error) {
                                // Silently fail observer setup for individual switches
                              }
                            }
                          });
                        } catch (error) {
                          // Silently fail switch processing
                        }
                      } catch (error) {
                        if (typeof console !== 'undefined' && console.error) {
                          console.error('Safari fix: Error in fixSafariIcons', error);
                        }
                      }
                    }
                    
                    function setupSafariFix() {
                      if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', fixSafariIcons);
                      } else {
                        fixSafariIcons();
                      }
                      
                      setTimeout(fixSafariIcons, 500);
                      setTimeout(fixSafariIcons, 1000);
                      setTimeout(fixSafariIcons, 2000);
                      
                      const debounce = (fn, delay) => {
                        let timeoutId;
                        return function(...args) {
                          clearTimeout(timeoutId);
                          timeoutId = setTimeout(() => fn.apply(this, args), delay);
                        };
                      };
                      
                      const debouncedFixIcons = debounce(fixSafariIcons, 200);
                      
                      // Setup body observer with safe observation
                      try {
                        const observer = new MutationObserver(debouncedFixIcons);
                        
                        function setupBodyObserver() {
                          if (document.body) {
                            safeObserve(observer, document.body, { 
                              childList: true, 
                              subtree: true 
                            });
                          }
                        }
                        
                        if (document.readyState === 'loading') {
                          document.addEventListener('DOMContentLoaded', setupBodyObserver);
                        } else {
                          setupBodyObserver();
                        }
                      } catch (error) {
                        if (typeof console !== 'undefined' && console.error) {
                          console.error('Safari fix: Error setting up body observer', error);
                        }
                      }
                      
                      if (window.addEventListener) {
                        window.addEventListener('popstate', fixSafariIcons);
                      }
                      
                      if (typeof window.history.pushState === 'function') {
                        const pushState = window.history.pushState;
                        window.history.pushState = function() {
                          pushState.apply(window.history, arguments);
                          setTimeout(fixSafariIcons, 200);
                        };
                      }
                      if (typeof window.history.replaceState === 'function') {
                        const replaceState = window.history.replaceState;
                        window.history.replaceState = function() {
                          replaceState.apply(window.history, arguments);
                          setTimeout(fixSafariIcons, 200);
                        };
                      }
                    }
                    
                    setupSafariFix();
                  }
                } catch (error) {
                  if (typeof console !== 'undefined' && console.error) {
                    console.error('Safari fix: Error in initialization', error);
                  }
                }
              })();
            `
          }}
        />
      </body>
    </html>
  )
} 