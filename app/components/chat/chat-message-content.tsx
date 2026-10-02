import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChatMessage } from "@/app/types/chat"
import { EmailViewer } from "@/app/components/email/EmailViewer"
import { isMimeMultipartMessage } from "@/app/utils/email-formatter"
import { parseSocialCommentContext } from "@/lib/chat/social-comment-context"
import { CommentReplyContext, useCommentDisplayContext } from "./CommentReplyContext"
import { PostContextCard } from "./PostContextCard"

const EMAIL_CONTENT_TOKEN = "email-content-token"

function removeAllHtmlTags(text: string): string {
  let cleaned = text.replace(/<[^>]*>/g, "")

  if (cleaned.includes("<")) {
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
  return cleaned
}

function formatMessageContent(text: string): string {
  if (isMimeMultipartMessage(text)) {
    return EMAIL_CONTENT_TOKEN
  }

  if (text && text.includes("<") && /<[^>]+>/.test(text) && !text.includes("**") && !text.includes("##")) {
    const cleaned = removeAllHtmlTags(text)
    return cleaned
  }

  return text
}

const markdownComponents: Components = {
  img: ({ src, alt, title }) => (
    <img
      style={{ maxWidth: "100%", height: "auto", borderRadius: "4px" }}
      src={src} alt={alt || ""} title={title}
    />
  ),
  pre: ({ children, className }) => (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        overflowX: "auto",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        maxWidth: "100%",
      }}
      className={className}
    >{children}</pre>
  ),
  code: ({ children, className }) => (
    <code
      style={{
        wordBreak: "break-word",
        overflowWrap: "break-word",
        whiteSpace: "pre-wrap",
      }}
      className={className}
    >{children}</code>
  ),
  table: ({ children, className }) => (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table className={className}>{children}</table>
    </div>
  ),
}

export function ChatMessageContent({ message }: { message: ChatMessage }) {
  const formattedContent = formatMessageContent(message.text)
  const postContext = parseSocialCommentContext(message.metadata)
  const { showMessagePostContext } = useCommentDisplayContext()

  return (
    <div className="flex flex-col gap-2 w-full">
      {postContext && showMessagePostContext && <PostContextCard context={postContext} compact />}
      <CommentReplyContext message={message} />
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

    </div>
  )
}
