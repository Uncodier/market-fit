import remarkGfm from "remark-gfm"
import { memo } from "react"
import ReactMarkdown from "react-markdown"
import { markdownComponents } from "../../simple-messages-view/utils/markdownComponents"

export const REMARK_PLUGINS = [remarkGfm]

export const MemoMarkdown = memo(function MemoMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  )
})
