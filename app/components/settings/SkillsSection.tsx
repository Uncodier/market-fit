"use client"

import { useState } from "react"
import { McpSkillCard } from "./McpSkillCard"
import { toast } from "sonner"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink } from "../ui/icons"
import { useLocalization } from "../../context/LocalizationContext"

interface Skill {
  id: string
  name: string
  description: string
  content: string
  rawContent: string
  tags: string[]
  docsUrl?: string
}

const SKILLS: Skill[] = [
  {
    id: "frontend-blog-seo",
    name: "Frontend Blog & SEO",
    description:
      "Guide for frontend agents to consume public site content, generate blog pages, and implement high-quality SEO, semantic HTML, and accessible design.",
    tags: ["SEO", "Blog", "Accessibility", "HTML"],
    docsUrl: "https://docs.makinari.com/skills/frontend",
    rawContent: `---
name: frontend-blog-seo
description: Guide for frontend agents to consume public site content, generate blog pages, and implement high-quality SEO, semantic HTML, and accessible design. Use when the user wants to create a blog, fetch public content for articles, or improve frontend SEO and typography.
---

# Frontend Blog & SEO Generation

## Quick Start

When asked to create a blog or consume public site content to generate articles:

1. **Fetch Content**: Implement robust fetching of public APIs or RSS feeds.
2. **SEO Optimization**: Add comprehensive metadata, OpenGraph tags, and JSON-LD schema.
3. **Semantic HTML**: Use proper HTML5 tags (\`<article>\`, \`<header>\`, \`<main>\`, \`<section>\`).
4. **Design & Typography**: Apply consistent typography (e.g., Tailwind Typography plugin) and ensure responsive layout.
5. **Accessibility**: Guarantee high contrast, proper ARIA labels, and keyboard navigability.

## Content Fetching

When consuming public content:

- **Error Handling**: Always include \`try/catch\` and fallback UI for missing data.
- **Caching & Revalidation**: In modern frameworks (like Next.js), use static generation (SSG) with revalidation (ISR) to keep the blog fast but updated.
- **Types**: Define TypeScript interfaces for the fetched content.

\`\`\`typescript
// Example Content Interface
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  author: {
    name: string;
    avatarUrl?: string;
  };
}
\`\`\`

## SEO Best Practices

Every blog page must include:

1. **Dynamic Meta Tags**: Title, description, and canonical URL based on the article content.
2. **OpenGraph & Twitter Cards**: For social sharing visibility.
3. **Structured Data (JSON-LD)**: Search engines use this to display rich snippets.

### JSON-LD Template

Always inject a structured data script in the \`<head>\` of individual blog posts:

\`\`\`html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Article Title",
    "image": ["https://example.com/image.jpg"],
    "datePublished": "2026-04-15T08:00:00+08:00",
    "dateModified": "2026-04-15T08:00:00+08:00",
    "author": [{
        "@type": "Person",
        "name": "Author Name"
    }]
  }
</script>
\`\`\`

## Design and Layout

The blog should look professional and focus on readability:

- **Container**: Limit the maximum width of the reading area (e.g., \`max-w-prose\` or \`max-w-3xl\`) for optimal line length (65-75 characters).
- **Typography**:
  - Use readable font sizes (e.g., \`text-lg\` or \`text-xl\` for body).
  - Ensure distinct hierarchy (\`h1\`, \`h2\`, \`h3\` with appropriate margins and font weights).
  - Use adequate line height (\`leading-relaxed\` or \`leading-loose\`).
- **Images**: Make images responsive. Include \`alt\` text for all images.

### Semantic HTML Example

\`\`\`html
<article class="max-w-prose mx-auto px-4 py-8">
  <header class="mb-8">
    <h1 class="text-4xl font-bold tracking-tight text-gray-900">Article Title</h1>
    <time datetime="2026-04-15" class="text-gray-500 text-sm">April 15, 2026</time>
  </header>
  
  <div class="prose prose-lg">
    <!-- Content goes here -->
  </div>
</article>
\`\`\`

## Accessibility (A11y)

- Contrast ratio must be at least 4.5:1 for standard text.
- Use \`aria-label\` on navigation links.
- Ensure the user can navigate back to the blog index easily.`,
    content: `# Frontend Blog & SEO Generation

## Quick Start

When asked to create a blog or consume public site content to generate articles:

1. **Fetch Content**: Implement robust fetching of public APIs or RSS feeds.
2. **SEO Optimization**: Add comprehensive metadata, OpenGraph tags, and JSON-LD schema.
3. **Semantic HTML**: Use proper HTML5 tags (\`<article>\`, \`<header>\`, \`<main>\`, \`<section>\`).
4. **Design & Typography**: Apply consistent typography (e.g., Tailwind Typography plugin) and ensure responsive layout.
5. **Accessibility**: Guarantee high contrast, proper ARIA labels, and keyboard navigability.

## Content Fetching

When consuming public content:

- **Error Handling**: Always include \`try/catch\` and fallback UI for missing data.
- **Caching & Revalidation**: In modern frameworks (like Next.js), use static generation (SSG) with revalidation (ISR) to keep the blog fast but updated.
- **Types**: Define TypeScript interfaces for the fetched content.

\`\`\`typescript
// Example Content Interface
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  author: {
    name: string;
    avatarUrl?: string;
  };
}
\`\`\`

## SEO Best Practices

Every blog page must include:

1. **Dynamic Meta Tags**: Title, description, and canonical URL based on the article content.
2. **OpenGraph & Twitter Cards**: For social sharing visibility.
3. **Structured Data (JSON-LD)**: Search engines use this to display rich snippets.

### JSON-LD Template

Always inject a structured data script in the \`<head>\` of individual blog posts:

\`\`\`html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Article Title",
    "image": ["https://example.com/image.jpg"],
    "datePublished": "2026-04-15T08:00:00+08:00",
    "dateModified": "2026-04-15T08:00:00+08:00",
    "author": [{
        "@type": "Person",
        "name": "Author Name"
    }]
  }
</script>
\`\`\`

## Design and Layout

The blog should look professional and focus on readability:

- **Container**: Limit the maximum width of the reading area (e.g., \`max-w-prose\` or \`max-w-3xl\`) for optimal line length (65-75 characters).
- **Typography**:
  - Use readable font sizes (e.g., \`text-lg\` or \`text-xl\` for body).
  - Ensure distinct hierarchy (\`h1\`, \`h2\`, \`h3\` with appropriate margins and font weights).
  - Use adequate line height (\`leading-relaxed\` or \`leading-loose\`).
- **Images**: Make images responsive. Include \`alt\` text for all images.

### Semantic HTML Example

\`\`\`html
<article class="max-w-prose mx-auto px-4 py-8">
  <header class="mb-8">
    <h1 class="text-4xl font-bold tracking-tight text-gray-900">Article Title</h1>
    <time datetime="2026-04-15" class="text-gray-500 text-sm">April 15, 2026</time>
  </header>
  
  <div class="prose prose-lg">
    <!-- Content goes here -->
  </div>
</article>
\`\`\`

## Accessibility (A11y)

- Contrast ratio must be at least 4.5:1 for standard text.
- Use \`aria-label\` on navigation links.
- Ensure the user can navigate back to the blog index easily.`,
  },
]

interface SkillsSectionProps {
  active: boolean
}

export function SkillsSection({ active }: SkillsSectionProps) {
  const { t } = useLocalization()
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const toggleSkill = (id: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleCopy = async (skill: Skill) => {
    try {
      await navigator.clipboard.writeText(skill.rawContent)
      setCopiedId(skill.id)
      toast.success(`${skill.name} ${t('settings.skills.copySuccess') || 'copied to clipboard'}`)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error(t('settings.skills.copyError') || "Failed to copy to clipboard")
    }
  }

  if (!active) return null

  return (
    <div id="skills" className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{t('settings.skills.title') || 'Code agent skills'}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t('settings.skills.description') || 'Skill bundles for coding agents: copy into your CLI or IDE to steer behavior, constraints, and workflows for autonomous code agents.'}
        </p>
      </div>

      {SKILLS.map((skill) => {
        const isExpanded = expandedSkills.has(skill.id)
        const isCopied = copiedId === skill.id

        return (
          <SectionCard
            key={skill.id}
            id={`skill-${skill.id}`}
          >
            <SectionCardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <SectionCardTitle>
                    {skill.name}
                  </SectionCardTitle>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {skill.description}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {skill.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className="p-2 hover:bg-muted/50 rounded-md transition-colors shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </SectionCardHeader>

            {isExpanded && (
              <SectionCardContent className="pb-0 pt-0">
                <div className="border dark:border-white/5 border-black/5 rounded-lg bg-muted/30 p-6 overflow-auto max-h-[500px]">
                  <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                    {skill.content}
                  </pre>
                </div>
              </SectionCardContent>
            )}

            <SectionCardFooter>
              {skill.docsUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(skill.docsUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('settings.skills.viewDocs') || 'View Docs'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCopy(skill)}
              >
                {isCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {t('settings.skills.copied') || 'Copied'}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('settings.skills.copySkill') || 'Copy Skill'}
                  </>
                )}
              </Button>
            </SectionCardFooter>
          </SectionCard>
        )
      })}
      <McpSkillCard />
    </div>
  )
}
