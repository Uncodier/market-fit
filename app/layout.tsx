import type { Metadata, Viewport } from 'next'
import { Inter } from "next/font/google"
import "./globals.css"
import "./safari-fix.css"
import { Toaster } from "sonner"
import ClientWrapper from './client-wrapper'
import Script from 'next/script'
import Providers from "./providers/Providers"
import { ThemeProvider } from "./hooks/use-theme"
import { shouldUseLayout } from './config/routes'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'Product Market Fit',
  description: 'Find your product market fit.',
}

// Configuración del viewport con ancho mínimo y escalado
export const viewport: Viewport = {
  initialScale: 0.8,
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
        <Script 
          src="/js/tracking.min.js" 
          data-site-id="www.uncodie.com" 
          data-debug="true"
          data-experiments="true"
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <Providers>
            <main className="min-h-screen bg-background">
              <ClientWrapper>
                {children}
              </ClientWrapper>
              <Toaster />
            </main>
          </Providers>
        </ThemeProvider>
        <Script id="safari-detection-and-fix">
          {`
            (function() {
              // Detectamos si estamos en Safari
              const isSafari = 
                navigator.userAgent.match(/AppleWebKit\\/[\\d.]+/g) &&
                navigator.userAgent.match(/Version\\/[\\d.]+.*Safari/) &&
                !navigator.userAgent.match(/Chrome\\/[\\d.]+/g);
              
              if (isSafari) {
                // Agregamos clase para identificar Safari
                document.documentElement.classList.add('safari');
                
                // Función para arreglar SVGs en Safari
                function fixSafariIcons() {
                  // Selecciona todos los elementos específicos con problemas
                  const selectors = [
                    'nav svg',
                    '[role="menuitem"] svg',
                    '.h-\\\\[25px\\\\].w-\\\\[25px\\\\] svg',
                    'input + div > svg',
                    'select + div > svg',
                    'button > svg',
                    '[class*="select-trigger"] svg',
                    '[class*="input"] svg',
                    'a:has(> svg) svg'
                  ];
                  
                  // Procesa cada icono según su contexto
                  selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(svg => {
                      const parent = svg.parentElement;
                      if (parent) {
                        parent.classList.add('safari-icon-fix');
                      }
                    });
                  });

                  // Fix específico para componentes Switch
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
                      
                      // Observar cambios en el atributo data-state
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
                  
                  // Fix específico para iconos en la sección security - forzando estilos extremos
                  function fixSecurityPage() {
                    // Intentar varios selectores para encontrar la página de seguridad
                    const isSecurityPage = 
                      window.location.href.includes('security') || 
                      document.querySelector('[href*="security"]') || 
                      document.querySelector('[class*="security"]');
                    
                    if (!isSecurityPage) return;
                    
                    console.log('Página de seguridad detectada, aplicando fixes específicos...');
                    
                    // Fix específico para los botones de ojo personalizados que agregamos
                    document.querySelectorAll('.safari-eye-button').forEach(button => {
                      // Aplicar estilos al botón
                      button.style.display = 'flex';
                      button.style.alignItems = 'center';
                      button.style.justifyContent = 'center';
                      button.style.position = 'absolute';
                      button.style.top = '50%';
                      button.style.right = '12px';
                      button.style.transform = 'translateY(-50%)';
                      button.style.width = '24px';
                      button.style.height = '24px';
                      button.style.minWidth = '24px';
                      button.style.minHeight = '24px';
                      button.style.zIndex = '9999';
                      button.style.padding = '0';
                      button.style.margin = '0';
                      button.style.background = 'transparent';
                      button.style.border = 'none';
                      button.style.outline = 'none';
                      button.style.opacity = '1';
                      button.style.visibility = 'visible';
                      button.style.pointerEvents = 'auto';
                      button.style.boxShadow = 'none';
                      button.style.whiteSpace = 'nowrap';
                      button.style.overflow = 'visible';
                      
                      // Arreglar el SVG dentro del botón
                      const svg = button.querySelector('svg');
                      if (svg) {
                        svg.style.display = 'block';
                        svg.style.position = 'static';
                        svg.style.width = '16px';
                        svg.style.height = '16px';
                        svg.style.minWidth = '16px';
                        svg.style.minHeight = '16px';
                        svg.style.margin = '0 auto';
                        svg.style.padding = '0';
                        svg.style.visibility = 'visible';
                        svg.style.opacity = '1';
                        svg.style.transform = 'none';
                      }
                    });
                    
                    // Fix específico para el Switch con clase safari-switch
                    document.querySelectorAll('.safari-switch').forEach(switchEl => {
                      // Estilos para el switch
                      switchEl.style.position = 'relative';
                      switchEl.style.display = 'inline-flex';
                      switchEl.style.alignItems = 'center';
                      switchEl.style.justifyContent = 'flex-start';
                      switchEl.style.width = '44px';
                      switchEl.style.height = '24px';
                      switchEl.style.cursor = 'pointer';
                      switchEl.style.borderRadius = '9999px';
                      switchEl.style.overflow = 'visible';
                      
                      // Encontrar y arreglar el thumb (span)
                      const thumb = switchEl.querySelector('span');
                      if (thumb) {
                        // Estilos base para el thumb
                        thumb.style.position = 'absolute';
                        thumb.style.left = '2px';
                        thumb.style.top = '2px';
                        thumb.style.width = '20px';
                        thumb.style.height = '20px';
                        thumb.style.borderRadius = '9999px';
                        thumb.style.marginLeft = '0';
                        thumb.style.transform = switchEl.getAttribute('data-state') === 'checked' ? 'translateX(20px)' : 'none';
                        thumb.style.transition = 'transform 0.2s ease';
                        
                        // Observar cambios de estado
                        const observer = new MutationObserver((mutations) => {
                          mutations.forEach((mutation) => {
                            if (mutation.attributeName === 'data-state') {
                              const state = switchEl.getAttribute('data-state');
                              thumb.style.transform = state === 'checked' ? 'translateX(20px)' : 'none';
                            }
                          });
                        });
                        
                        observer.observe(switchEl, { attributes: true });
                      }
                    });
                    
                    // Asegurarse de que todos los contenedores de input tengan posición relativa
                    document.querySelectorAll('div:has(> input)').forEach(container => {
                      container.style.position = 'relative';
                      container.style.display = 'block';
                      container.style.width = '100%';
                      
                      // Asegurar padding en el input para el icono
                      const input = container.querySelector('input');
                      if (input) {
                        input.style.paddingRight = '40px';
                      }
                    });
                    
                    // Fijar todos los iconos en inputs - especialmente el de ojo en password
                    const iconSelectors = [
                      'input ~ div:has(> svg)',
                      'input + div:has(> svg)',
                      'input ~ button:has(> svg)',
                      'input + button:has(> svg)',
                      '[class*="input"] div:has(> svg)',
                      '[class*="password"] div:has(> svg)',
                      '[class*="eye"]',
                      '[aria-label="Toggle password visibility"]',
                      '[class*="password-toggle"]'
                    ];
                    
                    iconSelectors.forEach(selector => {
                      document.querySelectorAll(selector).forEach(iconContainer => {
                        // Estilizar el contenedor como botón de modal (que sí funciona)
                        iconContainer.style.display = 'flex';
                        iconContainer.style.alignItems = 'center';
                        iconContainer.style.justifyContent = 'center';
                        iconContainer.style.position = 'absolute';
                        iconContainer.style.top = '50%';
                        iconContainer.style.right = '8px';
                        iconContainer.style.transform = 'translateY(-50%)';
                        iconContainer.style.width = '24px';
                        iconContainer.style.height = '24px';
                        iconContainer.style.minWidth = '24px';
                        iconContainer.style.minHeight = '24px';
                        iconContainer.style.padding = '0';
                        iconContainer.style.margin = '0';
                        iconContainer.style.zIndex = '2000';
                        iconContainer.style.pointerEvents = 'auto';
                        iconContainer.style.background = 'transparent';
                        iconContainer.style.opacity = '1';
                        iconContainer.style.visibility = 'visible';
                        iconContainer.style.border = 'none';
                        iconContainer.style.boxShadow = 'none';
                        
                        // Arreglar el SVG dentro
                        const svg = iconContainer.querySelector('svg');
                        if (svg) {
                          svg.style.display = 'block';
                          svg.style.position = 'static';
                          svg.style.visibility = 'visible';
                          svg.style.opacity = '1';
                          svg.style.width = '16px';
                          svg.style.height = '16px';
                          svg.style.minWidth = '16px';
                          svg.style.minHeight = '16px';
                          svg.style.margin = '0 auto';
                          svg.style.padding = '0';
                        }
                      });
                    });
                    
                    // Tratar especialmente los campos de contraseña
                    document.querySelectorAll('input[type="password"]').forEach(input => {
                      const parent = input.parentElement;
                      if (!parent) return;
                      
                      // Forzar posición relativa en el contenedor
                      parent.style.position = 'relative';
                      parent.style.display = 'block';
                      parent.style.width = '100%';
                      
                      // Asegurar padding para el icono
                      input.style.paddingRight = '40px';
                      
                      // Búsqueda agresiva de elementos cercanos que podrían ser el ícono de ojo
                      const iconLookupSelectors = [
                        'div:has(> svg)',
                        'button:has(> svg)',
                        '[class*="eye"]',
                        '[aria-label="Toggle password visibility"]',
                        '[class*="password-toggle"]'
                      ];
                      
                      // Intentar encontrar el ícono en diferentes niveles
                      let eyeIcon = null;
                      
                      // 1. Buscar en el padre
                      for (const selector of iconLookupSelectors) {
                        eyeIcon = parent.querySelector(selector);
                        if (eyeIcon) break;
                      }
                      
                      // 2. Buscar entre hermanos si no se encontró
                      if (!eyeIcon) {
                        for (const sibling of Array.from(parent.children)) {
                          if (sibling !== input && (
                            sibling.querySelector('svg') || 
                            sibling.tagName === 'BUTTON' ||
                            sibling.getAttribute('class')?.includes('eye') ||
                            sibling.getAttribute('class')?.includes('password')
                          )) {
                            eyeIcon = sibling;
                            break;
                          }
                        }
                      }
                      
                      // 3. Buscar en el padre del padre
                      if (!eyeIcon && parent.parentElement) {
                        for (const selector of iconLookupSelectors) {
                          eyeIcon = parent.parentElement.querySelector(selector);
                          if (eyeIcon) break;
                        }
                      }
                      
                      // Si se encontró, aplicar estilos agresivos
                      if (eyeIcon) {
                        // Estilos del botón X de modales que sí funciona
                        eyeIcon.style.display = 'flex';
                        eyeIcon.style.alignItems = 'center';
                        eyeIcon.style.justifyContent = 'center';
                        eyeIcon.style.position = 'absolute';
                        eyeIcon.style.top = '50%';
                        eyeIcon.style.right = '8px';
                        eyeIcon.style.transform = 'translateY(-50%)';
                        eyeIcon.style.width = '24px';
                        eyeIcon.style.height = '24px';
                        eyeIcon.style.minWidth = '24px';
                        eyeIcon.style.minHeight = '24px';
                        eyeIcon.style.padding = '0';
                        eyeIcon.style.margin = '0';
                        eyeIcon.style.zIndex = '2000';
                        eyeIcon.style.pointerEvents = 'auto';
                        eyeIcon.style.background = 'transparent';
                        eyeIcon.style.opacity = '1';
                        eyeIcon.style.visibility = 'visible';
                        eyeIcon.style.border = 'none';
                        eyeIcon.style.boxShadow = 'none';
                        
                        // Arreglar el SVG
                        const svg = eyeIcon.querySelector('svg');
                        if (svg) {
                          svg.style.display = 'block';
                          svg.style.position = 'static';
                          svg.style.visibility = 'visible';
                          svg.style.opacity = '1';
                          svg.style.width = '16px';
                          svg.style.height = '16px';
                          svg.style.minWidth = '16px';
                          svg.style.minHeight = '16px';
                          svg.style.margin = '0 auto';
                          svg.style.padding = '0';
                        }
                      }
                    });
                  }
                  
                  // Ejecutar fix específico para seguridad
                  fixSecurityPage();
                  
                  // Fix específico para iconos en inputs de la sección security
                  const securityInputs = document.querySelectorAll('[href*="security"] input, [href$="/security"] input, section:has([href*="security"]) input, [class*="security"] input');
                  securityInputs.forEach(input => {
                    // Asegurar padding derecho para evitar que el texto se solape con el icono
                    input.style.paddingRight = '40px';
                    
                    // Buscar el contenedor del ícono
                    const parent = input.parentElement;
                    if (!parent) return;
                    
                    // Asegurar que el contenedor principal tenga posición relativa
                    parent.style.position = 'relative';
                    parent.style.display = 'block';
                    parent.style.width = '100%';
                    
                    // Buscar el contenedor del ícono o el botón (por ejemplo, en inputs de password)
                    // Buscar en todos los niveles de adyacencia
                    const iconContainer = 
                      parent.querySelector('div:has(> svg)') || 
                      parent.querySelector('button:has(> svg)') ||
                      input.nextElementSibling || 
                      Array.from(parent.children).find(el => 
                        el !== input && 
                        (el.querySelector('svg') || 
                         el.tagName === 'BUTTON' || 
                         el.classList.contains('input-icon-wrapper') ||
                         el.getAttribute('class')?.includes('input-icon'))
                      );
                      
                    if (iconContainer) {
                      iconContainer.style.position = 'absolute';
                      iconContainer.style.right = '8px';
                      iconContainer.style.top = '50%';
                      iconContainer.style.transform = 'translateY(-50%)';
                      iconContainer.style.display = 'flex';
                      iconContainer.style.alignItems = 'center';
                      iconContainer.style.justifyContent = 'center';
                      iconContainer.style.zIndex = '2000';
                      iconContainer.style.width = '24px';
                      iconContainer.style.height = '24px';
                      iconContainer.style.minWidth = '24px';
                      iconContainer.style.minHeight = '24px';
                      iconContainer.style.visibility = 'visible';
                      iconContainer.style.opacity = '1';
                      iconContainer.style.pointerEvents = 'auto';
                      iconContainer.style.background = 'transparent';
                      iconContainer.style.padding = '0';
                      iconContainer.style.margin = '0';
                      iconContainer.style.border = 'none';
                      iconContainer.style.boxShadow = 'none';
                      
                      // Encontrar y arreglar el SVG
                      const svg = iconContainer.querySelector('svg');
                      if (svg) {
                        svg.style.display = 'block';
                        svg.style.visibility = 'visible';
                        svg.style.opacity = '1';
                        svg.style.width = '16px';
                        svg.style.height = '16px';
                        svg.style.minWidth = '16px';
                        svg.style.minHeight = '16px';
                        svg.style.position = 'static';
                        svg.style.margin = '0 auto';
                        svg.style.padding = '0';
                      }
                    }
                  });
                  
                  // Fix específico para inputs de tipo password
                  document.querySelectorAll('input[type="password"], [class*="password"] input').forEach(input => {
                    // Asegurar padding derecho para evitar que el texto se solape con el icono
                    input.style.paddingRight = '40px';
                    
                    const parent = input.parentElement;
                    if (!parent) return;
                    
                    // Asegurar que el contenedor principal tenga posición relativa
                    parent.style.position = 'relative';
                    parent.style.display = 'block';
                    parent.style.width = '100%';
                    
                    // Buscar el botón de toggle password o icono de ojo en varias posiciones posibles
                    const iconContainer = 
                      parent.querySelector('div:has(> svg)') || 
                      parent.querySelector('button:has(> svg)') ||
                      input.nextElementSibling || 
                      parent.querySelector('[aria-label="Toggle password visibility"]') ||
                      parent.querySelector('[class*="password-toggle"]') ||
                      parent.querySelector('[class*="eye"]') ||
                      Array.from(parent.children).find(el => 
                        el !== input && 
                        (el.querySelector('svg') || 
                         el.tagName === 'BUTTON')
                      );
                      
                    if (iconContainer) {
                      iconContainer.style.position = 'absolute';
                      iconContainer.style.right = '8px';
                      iconContainer.style.top = '50%';
                      iconContainer.style.transform = 'translateY(-50%)';
                      iconContainer.style.display = 'flex';
                      iconContainer.style.alignItems = 'center';
                      iconContainer.style.justifyContent = 'center';
                      iconContainer.style.zIndex = '2000';
                      iconContainer.style.width = '24px';
                      iconContainer.style.height = '24px';
                      iconContainer.style.minWidth = '24px';
                      iconContainer.style.minHeight = '24px';
                      iconContainer.style.visibility = 'visible';
                      iconContainer.style.opacity = '1';
                      iconContainer.style.pointerEvents = 'auto';
                      iconContainer.style.background = 'transparent';
                      iconContainer.style.border = 'none';
                      iconContainer.style.padding = '0';
                      iconContainer.style.margin = '0';
                      
                      // Encontrar y arreglar el SVG
                      const svg = iconContainer.querySelector('svg');
                      if (svg) {
                        svg.style.display = 'block';
                        svg.style.visibility = 'visible';
                        svg.style.opacity = '1';
                        svg.style.width = '16px';
                        svg.style.height = '16px';
                        svg.style.minWidth = '16px';
                        svg.style.minHeight = '16px';
                        svg.style.position = 'static';
                        svg.style.margin = '0 auto';
                        svg.style.padding = '0';
                      }
                    }
                  });
                  
                  // Fix especial para eye icons que puedan estar en otros niveles DOM
                  document.querySelectorAll('[class*="eye"]').forEach(el => {
                    el.style.position = 'absolute';
                    el.style.right = '8px';
                    el.style.top = '50%';
                    el.style.transform = 'translateY(-50%)';
                    el.style.display = 'flex';
                    el.style.alignItems = 'center';
                    el.style.justifyContent = 'center';
                    el.style.zIndex = '2000';
                    el.style.width = '24px';
                    el.style.height = '24px';
                    el.style.minWidth = '24px';
                    el.style.minHeight = '24px';
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                    el.style.pointerEvents = 'auto';
                    el.style.background = 'transparent';
                    el.style.border = 'none';
                    el.style.padding = '0';
                    el.style.margin = '0';
                    
                    const svg = el.querySelector('svg');
                    if (svg) {
                      svg.style.display = 'block';
                      svg.style.visibility = 'visible';
                      svg.style.opacity = '1';
                      svg.style.width = '16px';
                      svg.style.height = '16px';
                      svg.style.minWidth = '16px';
                      svg.style.minHeight = '16px';
                      svg.style.position = 'static';
                      svg.style.margin = '0 auto';
                      svg.style.padding = '0';
                    }
                  });
                }
                
                // Ejecutamos al cargar la página
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', fixSafariIcons);
                } else {
                  fixSafariIcons();
                }
                
                // Ejecutar después de un corto retraso para asegurar que los elementos dinámicos estén cargados
                setTimeout(fixSafariIcons, 500);
                setTimeout(fixSafariIcons, 1000);
                setTimeout(fixSafariIcons, 2000);
                
                // Observamos cambios en el DOM para aplicar arreglos a nuevos iconos
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
                
                // Escuchar cambios de navegación para replicar de nuevo los fixes
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
          `}
        </Script>
      </body>
    </html>
  )
} 