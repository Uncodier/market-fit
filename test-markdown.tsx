import { renderToString } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import React from 'react'

const text = `**Ficha Técnica:**\n- **Director:** Henry Selick\n- **Reparto (Voces):** Dakota Fanning\n\n📅 Fecha: Viernes 4`

const result = renderToString(
  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
    {text}
  </ReactMarkdown>
)

console.log(result)
