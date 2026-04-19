"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
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
  {
    id: "makinari",
    name: "Makinari MCP",
    description:
      "Operational guide to interact with the Makinari backend via MCP. Install the Makinari MCP, create an account at makinari.com, obtain API keys and use all its tools for OpenClaw workflows.",
    tags: ["MCP", "Backend", "Automation", "Leads"],
    docsUrl: "https://docs.makinari.com/skills/makinari",
    rawContent: `---
name: makinari
description: Guía operativa para interactuar con el backend de Makinari vía MCP. Instala el MCP de Makinari, permite crear cuenta en makinari.com, obtener API key y utilizar todas sus herramientas (tools) para flujos de trabajo en OpenClaw. Úsalo cuando se necesite integrar OpenClaw con Makinari o ejecutar tareas automatizadas, leads y campañas de Makinari.
---

# Makinari OpenClaw Skill

Esta skill proporciona las instrucciones y herramientas necesarias para instalar y utilizar el servidor MCP de Makinari, incluyendo la creación de cuentas, obtención de API keys y el uso adecuado de las herramientas proporcionadas por el MCP.

## Requisitos Previos

- Entorno OpenClaw y CLI de \`mcporter\`.
- Navegador o herramientas como \`browser\` disponibles.

## 1. Creación de Cuenta y Obtención de API Key

Para que el agente pueda interactuar con los servicios de Makinari, se requiere una cuenta activa en **makinari.com** y una API Key. Como agente OpenClaw, puedes asistir al usuario guiándolo o automatizando el proceso.

### Paso a paso (Manual / Guiado para el usuario)
1. Ve a [Makinari.com/signup](https://makinari.com/signup) o la página de registro.
2. Completa el formulario de registro con tu correo electrónico y contraseña.
3. Inicia sesión en tu cuenta.
4. Navega al panel de **Configuración (Settings)** o **API Keys**.
5. Haz clic en **Generar nueva API Key**.
6. Copia la API Key generada de forma segura.

### Automatización sugerida (Para Agentes con \`browser\`)
Si se te solicita crear la cuenta automáticamente, puedes utilizar la herramienta \`browser\` para navegar por el flujo de registro.

## 2. Instalación y Configuración del MCP de Makinari

Una vez obtenida la API Key, el siguiente paso es configurar el servidor MCP de Makinari en OpenClaw utilizando la herramienta CLI \`mcporter\`.

### Agregar el servidor MCP

Para registrar el servidor de Makinari en tu entorno OpenClaw, ejecuta el siguiente comando en la terminal. Reemplaza \`TU_API_KEY_AQUI\` por la clave real. 

\`\`\`bash
mcporter server add makinari \\
  --command "npx" \\
  --args "-y,@makinari/mcp-server" \\
  --env MAKINARI_API_KEY="TU_API_KEY_AQUI" \\
  --config "/home/sergio/.openclaw/workspace/config/mcporter.json"
\`\`\`

*Nota: Todas las llamadas a \`mcporter\` en OpenClaw DEBEN incluir \`--config /home/sergio/.openclaw/workspace/config/mcporter.json\`.*

### Verificar la instalación

Una vez agregado, verifica que el servidor se levanta correctamente y que las tools están disponibles:

\`\`\`bash
mcporter tool list makinari --config "/home/sergio/.openclaw/workspace/config/mcporter.json"
\`\`\`

## 3. Uso de Herramientas (Tools) del MCP y Ejemplos Prácticos

El MCP de Makinari expone diversas herramientas que deben utilizarse correctamente mediante la CLI \`mcporter\`. A continuación, se detalla la documentación y los ejemplos de uso de las herramientas más importantes.

**IMPORTANTE:** Todas las llamadas a \`mcporter\` en OpenClaw **DEBEN** incluir el flag \`--config /home/sergio/.openclaw/workspace/config/mcporter.json\` al final del comando.

### 3.1. \`makinari.instance_plan\`
Permite crear, leer y actualizar los pasos y el estado de ejecución de los planes (Plans) de un requerimiento. Es crucial para mantener al Orquestador (PM) informado de tu avance.

**Ejemplo - Actualizar el progreso de un paso (execute_step):**
\`\`\`bash
mcporter call makinari.instance_plan \\
  action="execute_step" \\
  plan_id="<PLAN_ID>" \\
  step_id="<STEP_ID>" \\
  step_output="Se ha completado el setup exitosamente." \\
  step_status="completed" \\
  instance_id="<INSTANCE_ID>" \\
  --config /home/sergio/.openclaw/workspace/config/mcporter.json
\`\`\`

**Ejemplo - Crear un nuevo plan (create):**
\`\`\`bash
mcporter call makinari.instance_plan \\
  action="create" \\
  requirement_id="<REQ_ID>" \\
  steps='[{"id":"step_1", "title":"Investigación", "status":"pending"}, {"id":"step_2", "title":"Desarrollo", "status":"pending"}]' \\
  --config /home/sergio/.openclaw/workspace/config/mcporter.json
\`\`\`

### 3.2. \`makinari.requirements\`
Gestiona los requerimientos (tickets) de los clientes, permitiendo obtener su información, actualizarlos o cambiar su estado (ej. pasar de 'backlog' a 'in-progress' o 'on-review').

**Ejemplo - Obtener los datos de un requerimiento (read):**
\`\`\`bash
mcporter call makinari.requirements \\
  action="read" \\
  requirement_id="<REQ_ID>" \\
  --config /home/sergio/.openclaw/workspace/config/mcporter.json
\`\`\`

**Ejemplo - Actualizar metadatos de un requerimiento (update):**
\`\`\`bash
mcporter call makinari.requirements \\
  action="update" \\
  requirement_id="<REQ_ID>" \\
  metadata='{"spawn_lock": "2023-10-27T10:00:00Z"}' \\
  --config /home/sergio/.openclaw/workspace/config/mcporter.json
\`\`\`

### 3.3. \`makinari.content\`
Se encarga de la generación, almacenamiento o recuperación de contenido y textos generados (copywriting, posts de blog, respuestas a clientes, etc.).

**Ejemplo - Guardar contenido generado:**
\`\`\`bash
mcporter call makinari.content \\
  action="create" \\
  requirement_id="<REQ_ID>" \\
  content_type="blog_post" \\
  body="El contenido completo de nuestro artículo..." \\
  --config /home/sergio/.openclaw/workspace/config/mcporter.json
\`\`\`

### 3.4. \`makinari.system_notification\`
Permite enviar notificaciones directamente al sistema o al usuario final (cliente). Muy útil para notificar cierres de tareas, alertas críticas o solicitud de revisiones.

**Ejemplo - Enviar notificación de finalización:**
\`\`\`bash
mcporter call makinari.system_notification \\
  action="send" \\
  target="client" \\
  message="Tu sitio web ha sido desplegado exitosamente en Vercel." \\
  severity="info" \\
  --config /home/sergio/.openclaw/workspace/config/mcporter.json
\`\`\`

## Referencias

- Vea \`references/tools.md\` para el detalle exhaustivo de todas las herramientas adicionales.
- Vea \`scripts/install_mcp.sh\` para el script de instalación automatizado.`,
    content: `# Makinari OpenClaw Skill

## Prerequisites

- OpenClaw environment and mcporter CLI.
- Browser or browser tools available.

## 1. Account Creation & API Key

1. Go to makinari.com/signup
2. Complete the registration form.
3. Sign in to your account.
4. Navigate to Settings > API Keys.
5. Generate and copy your API Key.

## 2. MCP Installation

Register the Makinari MCP server via mcporter:

  mcporter server add makinari \\
    --command "npx" \\
    --args "-y,@makinari/mcp-server" \\
    --env MAKINARI_API_KEY="YOUR_API_KEY" \\
    --config "<config-path>/mcporter.json"

Verify with: mcporter tool list makinari

## 3. Available Tools

### instance_plan
Create, read and update execution plan steps. Used to keep the Orchestrator (PM) informed of progress.

### requirements
Manage client requirements/tickets — read, update status (backlog → in-progress → on-review).

### content
Generate, store or retrieve generated content (copywriting, blog posts, client responses).

### system_notification
Send notifications to the system or end user for task closures, critical alerts or review requests.`,
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
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.skills.description') || 'Skill bundles for coding agents: copy into your CLI or IDE to steer behavior, constraints, and workflows for autonomous code agents.'}
        </p>
      </div>

      {SKILLS.map((skill) => {
        const isExpanded = expandedSkills.has(skill.id)
        const isCopied = copiedId === skill.id

        return (
          <Card
            key={skill.id}
            id={`skill-${skill.id}`}
            className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <CardHeader className="px-8 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle className="text-xl font-semibold">
                    {skill.name}
                  </CardTitle>
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
            </CardHeader>

            {isExpanded && (
              <CardContent className="px-8 pb-0 pt-0">
                <div className="border dark:border-white/5 border-black/5 rounded-lg bg-muted/30 p-6 overflow-auto max-h-[500px]">
                  <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                    {skill.content}
                  </pre>
                </div>
              </CardContent>
            )}

            <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end gap-3">
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
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
