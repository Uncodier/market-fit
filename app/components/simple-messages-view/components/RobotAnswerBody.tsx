import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { z } from 'zod'
import { useAuthContext } from '@/app/components/auth/auth-context'
import type { InstanceLog } from '../types'
import { markdownComponents } from '../utils/markdownComponents'

// Recognize only the producer's final receipt, not a link in arbitrary agent prose.
export function privateAnswerId(log: InstanceLog) {
  const id = log.parent_log_id
  return log.log_type === 'agent_action' && log.details?.response_type === 'assistant_response' &&
    id && z.string().uuid().safeParse(id).success && log.details.user_log_id === id &&
    ['connector', 'workspace'].some(source =>
      log.message === `This answer uses private ${source} data. [Open your answer](/robots/private-answer/${id}).`)
    ? id : null
}

function AnswerFrame({ actionId }: { actionId: string }) {
  const [visible, setVisible] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const hide = () => setVisible(false)
    const refresh = () => {
      setVisible(!document.hidden)
      setRevision(n => n + 1)
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', refresh)
    }
  }, [])

  // A new browsing context drops the old document *and* its pending navigation.
  // No answer text passes through React, workspace recording, or response actions.
  const path = `/robots/private-answer/${actionId}`
  return <>
    {visible && <iframe key={revision} title="Private Ask answer" className="w-full h-72 rounded-md border"
      sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" loading="lazy"
      src={`${path}/inline`} />}
    <a href={path} target="_blank" rel="noopener noreferrer">Open your answer in a new tab</a>
  </>
}

function PrivateAnswer({ actionId, owner }: { actionId: string; owner?: string | null }) {
  const { user, isLoading } = useAuthContext()
  if (isLoading || !owner || user?.id !== owner || user.is_anonymous !== false) {
    return <p>This answer is private to the person who requested it.</p>
  }
  return <AnswerFrame key={`${user.id}:${actionId}`} actionId={actionId} />
}

export function RobotAnswerBody({ log }: { log: InstanceLog }) {
  const id = privateAnswerId(log)
  if (id) return <PrivateAnswer actionId={id} owner={log.user_id} />
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{log.message}</ReactMarkdown>
}