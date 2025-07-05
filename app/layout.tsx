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
  title: 'Product Market Fit',
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
        <meta name="application-name" content="Market Fit" />
        <meta name="apple-mobile-web-app-title" content="Market Fit" />
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
                  window.MarketFit = window.MarketFit || {};
                  MarketFit.siteId = "9be0a6a2-5567-41bf-ad06-cb4014f0faf2";
                  
                  var script = document.createElement('script');
                  script.async = true;
                  script.src = 'https://files.uncodie.com/tracking.min.js';
                  
                  script.onload = function() {
                    if (window.MarketFit && typeof window.MarketFit.init === 'function') {
                      // Detect theme function
                      function detectTheme() {
                        const isDark = 
                          document.documentElement.classList.contains('dark') ||
                          document.body.classList.contains('dark') ||
                          document.documentElement.getAttribute('data-theme') === 'dark' ||
                          document.body.getAttribute('data-theme') === 'dark' ||
                          window.matchMedia('(prefers-color-scheme: dark)').matches;
                        
                        return isDark ? 'dark' : 'default';
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
                          allowAnonymousMessages: false,
                          position: "bottom-right",
                          title: "Customer and Tech Support",
                          welcomeMessage: "Welcome to Makret Fit! How can we assist you today?"
                        }
                      });
                      
                      // Function to update theme after initialization
                      function updateWidgetTheme() {
                        const currentTheme = detectTheme();
                        if (window.MarketFit && typeof window.MarketFit.setTheme === 'function') {
                          window.MarketFit.setTheme(currentTheme);
                        }
                      }
                      
                      // Watch for theme changes
                      const observer = new MutationObserver(updateWidgetTheme);
                      observer.observe(document.documentElement, { 
                        attributes: true, 
                        attributeFilter: ['class', 'data-theme'] 
                      });
                      observer.observe(document.body, { 
                        attributes: true, 
                        attributeFilter: ['class', 'data-theme'] 
                      });
                      
                      // Listen for system theme changes
                      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateWidgetTheme);
                    }
                  };
                  
                  var firstScript = document.getElementsByTagName('script')[0];
                  firstScript.parentNode.insertBefore(script, firstScript);
                })();
              `
            }}
          />
        )}

      </head>
      <body className={inter.className}>
        <Providers>
          <LoggerInit />
          <main className="min-h-screen bg-background">
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
                const isSafari = 
                  navigator.userAgent.match(/AppleWebKit\\/[\\d.]+/g) &&
                  navigator.userAgent.match(/Version\\/[\\d.]+.*Safari/) &&
                  !navigator.userAgent.match(/Chrome\\/[\\d.]+/g);
                
                if (isSafari) {
                  document.documentElement.classList.add('safari');
                  
                  function fixSafariIcons() {
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
                      document.querySelectorAll(selector).forEach(svg => {
                        const parent = svg.parentElement;
                        if (parent) {
                          parent.classList.add('safari-icon-fix');
                        }
                      });
                    });
                    
                    document.querySelectorAll('[role="switch"]').forEach(switchEl => {
                      const thumb = switchEl.querySelector('span') || switchEl.querySelector('[class*="thumb"]');
                      if (thumb) {
                        if (switchEl.getAttribute('data-state') === 'checked') {
                          thumb.style.marginLeft = '-20px';
                          thumb.style.transform = 'translateX(20px)';
                        } else {
                          thumb.style.marginLeft = '-20px';
                          thumb.style.transform = 'translateX(0)';
                        }
                        
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
                        
                        observer.observe(switchEl, { attributes: true });
                      }
                    });
                  }
                  
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
                  
                  const observer = new MutationObserver(debouncedFixIcons);
                  observer.observe(document.body, { 
                    childList: true, 
                    subtree: true 
                  });
                  
                  window.addEventListener('popstate', fixSafariIcons);
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
              })();
            `
          }}
        />
      </body>
    </html>
  )
} 