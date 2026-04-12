import React, { useRef, useEffect, useState, useMemo } from 'react'
import {
  MessageSquare, TrendingUp, Users, Target, Sparkles, BarChart,
  Megaphone, Rocket, PieChart, Globe, ClipboardList, Mail,
  Star, Search, PenSquare, FlaskConical, PlayCircle, Image,
  Type, CreditCard, Phone
} from '@/app/components/ui/icons'

interface PromptCard {
  icon: React.ReactNode
  label: string
  prompt: string
  color: string
}

const ALL_PROMPT_CARDS: PromptCard[] = [
  // Strategy
  {
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Analizar ajuste de mercado',
    prompt: 'Analiza nuestro ajuste producto-mercado actual e identifica las mayores brechas que deberíamos abordar.',
    color: 'text-blue-500',
  },
  {
    icon: <Users className="h-4 w-4" />,
    label: 'Definir perfil de cliente ideal (ICP)',
    prompt: 'Ayúdame a definir nuestro perfil de cliente ideal basado en nuestros leads y datos de clientes actuales.',
    color: 'text-purple-500',
  },
  {
    icon: <Target className="h-4 w-4" />,
    label: 'Estrategia de lanzamiento',
    prompt: 'Crea una estrategia de lanzamiento para nuestro producto dirigida a los primeros usuarios.',
    color: 'text-green-500',
  },
  {
    icon: <BarChart className="h-4 w-4" />,
    label: 'Análisis competitivo',
    prompt: 'Ejecuta un análisis competitivo y resalta nuestros diferenciadores clave frente a los 3 principales competidores.',
    color: 'text-cyan-500',
  },
  {
    icon: <Rocket className="h-4 w-4" />,
    label: 'Tácticas de crecimiento',
    prompt: '¿Cuáles son las tácticas de crecimiento más efectivas que podemos implementar en los próximos 30 días?',
    color: 'text-violet-500',
  },
  {
    icon: <PieChart className="h-4 w-4" />,
    label: 'Desglose de ingresos',
    prompt: 'Desglosa nuestros ingresos por segmento e identifica qué canales tienen el mayor potencial de crecimiento.',
    color: 'text-yellow-500',
  },
  {
    icon: <Globe className="h-4 w-4" />,
    label: 'Mercados de expansión',
    prompt: '¿Qué nuevos mercados o geografías deberíamos considerar para expandirnos, y cuál sería la estrategia de entrada?',
    color: 'text-sky-500',
  },
  {
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'Hoja de ruta del producto',
    prompt: 'Ayúdame a priorizar nuestra hoja de ruta del producto en base a los comentarios de los clientes y la demanda del mercado.',
    color: 'text-indigo-500',
  },
  {
    icon: <Star className="h-4 w-4" />,
    label: 'Éxito del cliente',
    prompt: '¿Qué iniciativas de éxito del cliente deberíamos implementar para mejorar la retención y reducir la deserción?',
    color: 'text-amber-500',
  },
  {
    icon: <FlaskConical className="h-4 w-4" />,
    label: 'Ideas para pruebas A/B',
    prompt: 'Sugiere pruebas A/B que deberíamos ejecutar en nuestra página de destino y flujo de incorporación para mejorar la conversión.',
    color: 'text-emerald-500',
  },
  // Campaigns & ads
  {
    icon: <Megaphone className="h-4 w-4" />,
    label: 'Ideas de campañas',
    prompt: 'Sugiere 5 ideas creativas de campañas de marketing para aumentar el conocimiento de la marca e impulsar las suscripciones.',
    color: 'text-orange-500',
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    label: 'Propuesta de valor',
    prompt: 'Refina nuestra propuesta de valor para hacerla más atractiva para nuestra audiencia objetivo.',
    color: 'text-pink-500',
  },
  {
    icon: <CreditCard className="h-4 w-4" />,
    label: 'Estrategia de anuncios pagados',
    prompt: 'Diseña una estrategia de anuncios pagados para Meta y Google dirigida a nuestro ICP. Incluye distribución de presupuesto, formatos de anuncios y KPIs.',
    color: 'text-blue-400',
  },
  {
    icon: <Phone className="h-4 w-4" />,
    label: 'Plan de redes sociales',
    prompt: 'Crea un calendario de contenido de redes sociales de 4 semanas para Instagram, LinkedIn y X centrado en el lanzamiento de nuestro producto.',
    color: 'text-rose-500',
  },
  // Copies & messaging
  {
    icon: <Type className="h-4 w-4" />,
    label: 'Copy de la página de destino',
    prompt: 'Escribe un copy atractivo para la página de destino: titular, subtitular, sección de beneficios y CTA para nuestro producto principal.',
    color: 'text-fuchsia-500',
  },
  {
    icon: <MessageSquare className="h-4 w-4" />,
    label: 'Mensajes para clientes',
    prompt: 'Escribe mensajes orientados al cliente que comuniquen claramente los beneficios de nuestro producto e impulsen las conversiones.',
    color: 'text-teal-500',
  },
  {
    icon: <Mail className="h-4 w-4" />,
    label: 'Prospección en frío',
    prompt: 'Escribe una secuencia de correos electrónicos de prospección en frío (3 correos) para nuestro principal segmento ICP que impulse la reserva de demostraciones.',
    color: 'text-rose-400',
  },
  {
    icon: <PenSquare className="h-4 w-4" />,
    label: 'Variantes de copy de anuncio',
    prompt: 'Escribe 5 variantes de copy de anuncio (titular + descripción) para un anuncio de Facebook promocionando nuestro producto a compradores primerizos.',
    color: 'text-orange-400',
  },
  // Content & SEO
  {
    icon: <Search className="h-4 w-4" />,
    label: 'Estrategia de SEO',
    prompt: 'Crea una estrategia de contenido de SEO para aumentar el tráfico orgánico y generar leads entrantes.',
    color: 'text-lime-500',
  },
  {
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'Plan de contenido',
    prompt: 'Crea un plan de marketing de contenido de 3 meses alineado con los lanzamientos de nuestros productos y nuestra audiencia objetivo.',
    color: 'text-indigo-400',
  },
  // Images
  {
    icon: <Image className="h-4 w-4" />,
    label: 'Imagen principal',
    prompt: 'Genera una imagen principal para nuestra página de destino: moderna, limpia, mostrando nuestro producto en uso por un profesional en una oficina iluminada.',
    color: 'text-green-400',
  },
  {
    icon: <Image className="h-4 w-4" />,
    label: 'Imágenes para redes sociales',
    prompt: 'Genera 3 imágenes para publicaciones en redes sociales sobre el lanzamiento de nuestro producto: colores vivos, texto mínimo, optimizado para el formato cuadrado de Instagram.',
    color: 'text-pink-400',
  },
  {
    icon: <Image className="h-4 w-4" />,
    label: 'Creatividad de anuncio',
    prompt: 'Genera una imagen creativa para un anuncio de Facebook: mockup del producto en un fondo limpio con un fuerte gancho visual y colores de la marca.',
    color: 'text-violet-400',
  },
  {
    icon: <Image className="h-4 w-4" />,
    label: 'Imagen de portada para blog',
    prompt: 'Genera una imagen de portada para una publicación de blog sobre el ajuste producto-mercado: abstracta, profesional, con un tema visual de datos/crecimiento.',
    color: 'text-cyan-400',
  },
  // Videos
  {
    icon: <PlayCircle className="h-4 w-4" />,
    label: 'Video de demostración de producto',
    prompt: 'Genera un breve video de demostración del producto (15s) mostrando las características clave de nuestra plataforma en un estilo de recorrido limpio por la interfaz de usuario.',
    color: 'text-red-500',
  },
  {
    icon: <PlayCircle className="h-4 w-4" />,
    label: 'Anuncio en video para redes sociales',
    prompt: 'Genera un anuncio en video vertical de 15 segundos para TikTok/Reels: de ritmo rápido, subtítulos audaces, mostrando el problema que resolvemos y nuestra solución.',
    color: 'text-red-400',
  },
  {
    icon: <PlayCircle className="h-4 w-4" />,
    label: 'Video explicativo',
    prompt: 'Genera un video explicativo de 30 segundos que comunique nuestra propuesta de valor utilizando gráficos en movimiento y un arco narrativo claro.',
    color: 'text-orange-500',
  },
]

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface EmptyStatePromptsProps {
  onSelectPrompt: (prompt: string) => void
}

export const EmptyStatePrompts: React.FC<EmptyStatePromptsProps> = ({ onSelectPrompt }) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const isPausedRef = useRef(false)
  const isStoppedRef = useRef(false)
  const offsetRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const animIdRef = useRef<number>(0)

  const PX_PER_SECOND = 35

  // Shuffle once on mount
  const cards = useMemo(() => shuffle(ALL_PROMPT_CARDS), [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp
      const delta = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      if (!isPausedRef.current && !isStoppedRef.current) {
        offsetRef.current += (PX_PER_SECOND * delta) / 1000

        const halfWidth = track.scrollWidth / 2
        if (offsetRef.current >= halfWidth) {
          offsetRef.current -= halfWidth
        }

        track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`
      } else {
        lastTimeRef.current = timestamp
      }

      animIdRef.current = requestAnimationFrame(animate)
    }

    animIdRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animIdRef.current)
  }, [])

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const handleSelect = (prompt: string, index: number) => {
    isStoppedRef.current = true
    setSelectedIndex(index % cards.length)
    onSelectPrompt(prompt)
  }

  const allCards = [...cards, ...cards]

  return (
    <div className="w-full relative flex flex-col items-center justify-center overflow-visible">
      <div
        className="w-full relative overflow-hidden flex-shrink-0"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 128px, black calc(100% - 128px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 128px, black calc(100% - 128px), transparent)'
        }}
        onMouseEnter={() => { isPausedRef.current = true }}
        onMouseLeave={() => { isPausedRef.current = false }}
        onTouchStart={() => { isPausedRef.current = true }}
        onTouchEnd={() => { isPausedRef.current = false }}
      >
        <div
          ref={trackRef}
          className="flex gap-2 pb-1 px-1 will-change-transform"
          style={{ width: 'max-content' }}
        >
          {allCards.map((card, i) => {
            const isSelected = selectedIndex === i % cards.length
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(card.prompt, i)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors duration-150 text-left group ${
                  isSelected
                    ? 'border-primary/50 bg-accent'
                    : 'dark:border-white/5 border-black/5 bg-background/60 hover:bg-accent hover:border-primary/30'
                }`}
              >
                <span className={`flex-shrink-0 ${card.color}`}>{card.icon}</span>
                <span className={`text-xs whitespace-nowrap transition-colors duration-150 ${
                  isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                }`}>
                  {card.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
