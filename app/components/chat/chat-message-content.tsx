import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChatMessage } from "@/app/types/chat"
import { EmailViewer } from "@/app/components/email/EmailViewer"
import { isMimeMultipartMessage } from "@/app/utils/email-formatter"
import { CommentSourceLinks } from "./CommentSourceLinks"

const EMAIL_CONTENT_TOKEN = "email-content-token"

function removeAllHtmlTags(text: string): string {
  console.log("🔧 [removeAllHtmlTags] Input:", text.substring(0, 100) + "...")

  let cleaned = text.replace(/<[^>]*>/g, "")

  if (cleaned.includes("<")) {
    console.log("🔧 [removeAllHtmlTags] First method failed, trying character approach...")
    let result = ""
    let inTag = false

    for (const char of cleaned) {
      if (char === "<") {
        inTag = true
      } else if (char === ">") {
        inTag = false
      } else if (!inTag) {
        result += char
      }
    }
    cleaned = result
  }

  cleaned = cleaned.replace(/\s+/g, " ").trim()
  console.log("🔧 [removeAllHtmlTags] Output:", cleaned.substring(0, 100) + "...")
  return cleaned
}

function formatMessageContent(text: string, metadata?: any): string {
  console.log("🔍 [formatMessageContent] RAW MESSAGE:", text)
  console.log("🔍 [formatMessageContent] METADATA:", metadata)
  console.log("🔍 [formatMessageContent] Text type:", typeof text)
  console.log("🔍 [formatMessageContent] Text length:", text?.length)

  if (isMimeMultipartMessage(text)) {
    console.log("✅ [formatMessageContent] Email content detected")
    return EMAIL_CONTENT_TOKEN
  }

  if (text && text.includes("<") && /<[^>]+>/.test(text) && !text.includes("**") && !text.includes("##")) {
    console.log("🧽 [formatMessageContent] HTML cleanup for HTML content...")
    const cleaned = removeAllHtmlTags(text)
    console.log("✨ [formatMessageContent] Cleaned HTML result:", cleaned.substring(0, 100) + "...")
    return cleaned
  }

  console.log("⚠️ [formatMessageContent] Returning original text for markdown/plain text")
  return text
}

const markdownComponents = {
  img: ({ node: _node, ...props }: any) => (
    <img
      style={{ maxWidth: "100%", height: "auto", borderRadius: "4px" }}
      {...props}
    />
  ),
  pre: ({ node: _node, ...props }: any) => (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        overflowX: "auto",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        maxWidth: "100%",
      }}
      {...props}
    />
  ),
  code: ({ node: _node, ...props }: any) => (
    <code
      style={{
        wordBreak: "break-word",
        overflowWrap: "break-word",
        whiteSpace: "pre-wrap",
      }}
      {...props}
    />
  ),
  table: ({ node: _node, ...props }: any) => (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table {...props} />
    </div>
  ),
}

export function ChatMessageContent({ message }: { message: ChatMessage }) {
  const formattedContent = formatMessageContent(message.text, message.metadata)
  const isComment =
    message.metadata?.source === "comment" || message.metadata?.outstand_post_id

  return (
    <div className="flex flex-col gap-2 w-full">
      {formattedContent === EMAIL_CONTENT_TOKEN ? (
        <EmailViewer emailContent={message.text} className="w-full" />
      ) : (
        <div
          className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words word-wrap hyphens-auto"
          style={{
            wordWrap: "break-word",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {formattedContent}
          </ReactMarkdown>
        </div>
      )}

      {isComment && (
        <CommentSourceLinks
          contentId={
            typeof message.metadata?.content_id === "string"
              ? message.metadata.content_id
              : undefined
          }
          outstandPostId={
            typeof message.metadata?.outstand_post_id === "string"
              ? message.metadata.outstand_post_id
              : undefined
          }
          platformPostUrl={
            typeof message.metadata?.platform_post_url === "string"
              ? message.metadata.platform_post_url
              : undefined
          }
        />
      )}
    </div>
  )
}
