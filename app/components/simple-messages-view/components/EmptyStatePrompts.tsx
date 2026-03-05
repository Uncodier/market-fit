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
    label: 'Analyze market fit',
    prompt: 'Analyze our current product-market fit and identify the biggest gaps we should address.',
    color: 'text-blue-500',
  },
  {
    icon: <Users className="h-4 w-4" />,
    label: 'Define ICP',
    prompt: 'Help me define our ideal customer profile based on our current leads and customer data.',
    color: 'text-purple-500',
  },
  {
    icon: <Target className="h-4 w-4" />,
    label: 'Go-to-market strategy',
    prompt: 'Create a go-to-market strategy for our product targeting early adopters.',
    color: 'text-green-500',
  },
  {
    icon: <BarChart className="h-4 w-4" />,
    label: 'Competitive analysis',
    prompt: 'Run a competitive analysis and highlight our key differentiators versus the top 3 competitors.',
    color: 'text-cyan-500',
  },
  {
    icon: <Rocket className="h-4 w-4" />,
    label: 'Growth tactics',
    prompt: 'What are the most effective growth tactics we can implement in the next 30 days?',
    color: 'text-violet-500',
  },
  {
    icon: <PieChart className="h-4 w-4" />,
    label: 'Revenue breakdown',
    prompt: 'Break down our revenue by segment and identify which channels have the highest growth potential.',
    color: 'text-yellow-500',
  },
  {
    icon: <Globe className="h-4 w-4" />,
    label: 'Expansion markets',
    prompt: 'Which new markets or geographies should we consider expanding into, and what would be the entry strategy?',
    color: 'text-sky-500',
  },
  {
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'Product roadmap',
    prompt: 'Help me prioritize our product roadmap based on customer feedback and market demand.',
    color: 'text-indigo-500',
  },
  {
    icon: <Star className="h-4 w-4" />,
    label: 'Customer success',
    prompt: 'What customer success initiatives should we implement to improve retention and reduce churn?',
    color: 'text-amber-500',
  },
  {
    icon: <FlaskConical className="h-4 w-4" />,
    label: 'A/B test ideas',
    prompt: 'Suggest A/B tests we should run on our landing page and onboarding flow to improve conversion.',
    color: 'text-emerald-500',
  },
  // Campaigns & ads
  {
    icon: <Megaphone className="h-4 w-4" />,
    label: 'Campaign ideas',
    prompt: 'Suggest 5 creative marketing campaign ideas to increase brand awareness and drive signups.',
    color: 'text-orange-500',
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    label: 'Value proposition',
    prompt: 'Refine our value proposition to make it more compelling for our target audience.',
    color: 'text-pink-500',
  },
  {
    icon: <CreditCard className="h-4 w-4" />,
    label: 'Paid ads strategy',
    prompt: 'Design a paid ads strategy for Meta and Google targeting our ICP. Include budget split, ad formats and KPIs.',
    color: 'text-blue-400',
  },
  {
    icon: <Phone className="h-4 w-4" />,
    label: 'Social media plan',
    prompt: 'Create a 4-week social media content calendar for Instagram, LinkedIn and X focused on our product launch.',
    color: 'text-rose-500',
  },
  // Copies & messaging
  {
    icon: <Type className="h-4 w-4" />,
    label: 'Landing page copy',
    prompt: 'Write compelling landing page copy — headline, subheadline, benefits section and CTA — for our main product.',
    color: 'text-fuchsia-500',
  },
  {
    icon: <MessageSquare className="h-4 w-4" />,
    label: 'Customer messaging',
    prompt: 'Write customer-facing messaging that clearly communicates our product benefits and drives conversions.',
    color: 'text-teal-500',
  },
  {
    icon: <Mail className="h-4 w-4" />,
    label: 'Cold outreach',
    prompt: 'Write a cold outreach email sequence (3 emails) for our top ICP segment that drives demo bookings.',
    color: 'text-rose-400',
  },
  {
    icon: <PenSquare className="h-4 w-4" />,
    label: 'Ad copy variants',
    prompt: 'Write 5 ad copy variants (headline + description) for a Facebook ad promoting our product to first-time buyers.',
    color: 'text-orange-400',
  },
  // Content & SEO
  {
    icon: <Search className="h-4 w-4" />,
    label: 'SEO strategy',
    prompt: 'Create an SEO content strategy to increase organic traffic and generate inbound leads.',
    color: 'text-lime-500',
  },
  {
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'Content plan',
    prompt: 'Build a 3-month content marketing plan aligned with our product launches and target audience.',
    color: 'text-indigo-400',
  },
  // Images
  {
    icon: <Image className="h-4 w-4" />,
    label: 'Hero image',
    prompt: 'Generate a hero image for our landing page: modern, clean, showing our product in use by a professional in a bright office.',
    color: 'text-green-400',
  },
  {
    icon: <Image className="h-4 w-4" />,
    label: 'Social media visuals',
    prompt: 'Generate 3 social media post visuals for our product launch: bold colors, minimal text, optimized for Instagram square format.',
    color: 'text-pink-400',
  },
  {
    icon: <Image className="h-4 w-4" />,
    label: 'Ad creative',
    prompt: 'Generate a Facebook ad creative image: product mockup on a clean background with a strong visual hook and brand colors.',
    color: 'text-violet-400',
  },
  {
    icon: <Image className="h-4 w-4" />,
    label: 'Blog cover image',
    prompt: 'Generate a blog post cover image for an article about product-market fit: abstract, professional, with a data/growth visual theme.',
    color: 'text-cyan-400',
  },
  // Videos
  {
    icon: <PlayCircle className="h-4 w-4" />,
    label: 'Product demo video',
    prompt: 'Generate a short product demo video (15s) showing the key features of our platform in a clean UI walkthrough style.',
    color: 'text-red-500',
  },
  {
    icon: <PlayCircle className="h-4 w-4" />,
    label: 'Social video ad',
    prompt: 'Generate a 15-second vertical video ad for TikTok/Reels: fast-paced, bold captions, showing the problem we solve and our solution.',
    color: 'text-red-400',
  },
  {
    icon: <PlayCircle className="h-4 w-4" />,
    label: 'Explainer video',
    prompt: 'Generate a 30-second explainer video that communicates our value proposition using motion graphics and a clear narrative arc.',
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
