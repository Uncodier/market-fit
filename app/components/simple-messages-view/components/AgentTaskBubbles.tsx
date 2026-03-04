import React from 'react'

const TASK_BUBBLES: Array<{
  text: string
  color: string
  position: string
  animation: string
  delay: string
  size: 'sm' | 'md' | 'lg'
}> = [
  {
    text: "Write a cold email sequence for SaaS leads",
    color: "bg-violet-100/80 text-violet-700 border-violet-200/60 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40",
    position: "top-[18%] left-[12%]",
    animation: "animate-float-slow",
    delay: "0s",
    size: "md",
  },
  {
    text: "Find ICP companies on LinkedIn",
    color: "bg-indigo-100/80 text-indigo-700 border-indigo-200/60 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700/40",
    position: "top-[10%] right-[18%]",
    animation: "animate-float-medium",
    delay: "3s",
    size: "sm",
  },
  {
    text: "Summarize last week's conversations",
    color: "bg-pink-100/80 text-pink-700 border-pink-200/60 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700/40",
    position: "top-[32%] left-[5%]",
    animation: "animate-float-reverse",
    delay: "6s",
    size: "sm",
  },
  {
    text: "Generate a product demo script",
    color: "bg-emerald-100/80 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
    position: "top-[22%] right-[6%]",
    animation: "animate-float-slow",
    delay: "9s",
    size: "md",
  },
  {
    text: "Qualify leads from last campaign",
    color: "bg-cyan-100/80 text-cyan-700 border-cyan-200/60 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700/40",
    position: "top-[42%] left-[8%]",
    animation: "animate-float-fast",
    delay: "2s",
    size: "sm",
  },
  {
    text: "Create a 30-day content calendar",
    color: "bg-rose-100/80 text-rose-700 border-rose-200/60 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/40",
    position: "top-[14%] left-[38%]",
    animation: "animate-float-medium",
    delay: "5s",
    size: "md",
  },
  {
    text: "Draft follow-up messages for open deals",
    color: "bg-teal-100/80 text-teal-700 border-teal-200/60 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700/40",
    position: "top-[38%] right-[10%]",
    animation: "animate-float-reverse",
    delay: "7s",
    size: "md",
  },
  {
    text: "Analyze churn risk segments",
    color: "bg-purple-100/80 text-purple-700 border-purple-200/60 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/40",
    position: "top-[52%] left-[15%]",
    animation: "animate-float-slow",
    delay: "4s",
    size: "sm",
  },
  {
    text: "Build an outbound campaign for Q2",
    color: "bg-blue-100/80 text-blue-700 border-blue-200/60 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
    position: "top-[55%] right-[14%]",
    animation: "animate-float-medium",
    delay: "1s",
    size: "md",
  },
  {
    text: "Scrape contact info from target accounts",
    color: "bg-amber-100/80 text-amber-700 border-amber-200/60 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
    position: "top-[28%] right-[30%]",
    animation: "animate-float-fast",
    delay: "8s",
    size: "sm",
  },
  {
    text: "Translate campaign copy to Spanish",
    color: "bg-fuchsia-100/80 text-fuchsia-700 border-fuchsia-200/60 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-700/40",
    position: "top-[62%] left-[35%]",
    animation: "animate-float-reverse",
    delay: "11s",
    size: "sm",
  },
  {
    text: "Generate weekly performance report",
    color: "bg-lime-100/80 text-lime-700 border-lime-200/60 dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-700/40",
    position: "top-[48%] right-[32%]",
    animation: "animate-float-slow",
    delay: "13s",
    size: "md",
  },
]

const sizeClasses = {
  sm: "text-xs px-3 py-1.5",
  md: "text-xs px-4 py-2",
  lg: "text-sm px-5 py-2.5",
}

export function AgentTaskBubbles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {TASK_BUBBLES.map((bubble, i) => (
        <div
          key={i}
          className={`absolute ${bubble.position} ${bubble.animation}`}
          style={{ animationDelay: bubble.delay }}
        >
          <div
            className={`flex items-center justify-center rounded-full border shadow-sm backdrop-blur-sm ${bubble.color} ${sizeClasses[bubble.size]}`}
          >
            <span className="font-medium">{bubble.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
