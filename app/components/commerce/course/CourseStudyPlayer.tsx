'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/app/components/ui/accordion'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle, PlayCircle, FileText } from '@/app/components/ui/icons'
import { cn } from '@/lib/utils'
import { formatCourseTime, type CourseItem } from './course-model'
import { useStudyProgress } from './use-study-progress'
import { StudyVideo } from './StudyVideo'

export function CourseStudyPlayer({ item, storageKey, backUrl }: { item: CourseItem; storageKey: string; backUrl: string }) {
  const videos = item.metadata?.videos?.filter(video => video && typeof video.url === 'string' && video.url.trim()) || []
  const { progress, update, ready, storageError } = useStudyProgress(storageKey, videos.length)
  const [focus, setFocus] = useState(false)
  const [tab, setTab] = useState('overview')
  const [openModules, setOpenModules] = useState<string[]>(['module-0'])
  const heading = useRef<HTMLHeadingElement>(null)
  const currentIndex = progress.lastIndex
  const current = videos[currentIndex]
  const completed = progress.completedIndexes.includes(currentIndex)
  const percent = videos.length ? Math.round(progress.completedIndexes.length / videos.length * 100) : 0
  const attributes = item.metadata?.attributes
  const specs = item.metadata?.specs || []
  // The catalog stores an ordered video list, not module metadata.
  const modules = Array.from({ length: Math.ceil(videos.length / 3) }, (_, index) => ({
    id: `module-${index}`, start: index * 3, lessons: videos.slice(index * 3, index * 3 + 3),
  }))

  function selectLesson(index: number) {
    if (index < 0 || index >= videos.length) return
    update(previous => ({ ...previous, lastIndex: index }))
    const moduleId = `module-${Math.floor(index / 3)}`
    setOpenModules(previous => previous.includes(moduleId) ? previous : [...previous, moduleId])
    heading.current?.focus()
  }

  function setCompleted(value: boolean) {
    update(previous => ({ ...previous, completedIndexes: value
      ? [...new Set([...previous.completedIndexes, currentIndex])]
      : previous.completedIndexes.filter(index => index !== currentIndex) }))
  }

  return <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" size="sm" asChild><Link href={backUrl}><ArrowLeft className="mr-2 h-4 w-4" />Back to library</Link></Button>
      <div className="flex items-center gap-3"><Badge variant="secondary">Course preview</Badge><span className="text-xs text-muted-foreground">Progress saved on this device</span></div>
    </div>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="h-4 w-4" />Acme Workplace · Learning library</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{item.name}</h1>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{[attributes?.level, attributes?.language, attributes?.duration, `${videos.length} lessons`].filter(Boolean).map(value => <Badge key={value} variant="outline">{value}</Badge>)}</div>
      </div>
      <Button variant="outline" size="sm" aria-pressed={focus} onClick={() => setFocus(value => !value)}>{focus ? 'Show course content' : 'Focus mode'}</Button>
    </header>
    {storageError && <p role="alert" className="rounded-xl border p-3 text-sm">Browser storage is unavailable. You can keep learning, but progress and notes may not survive a reload.</p>}
    {!ready ? <div role="status" className="aspect-video animate-pulse rounded-2xl bg-muted"><span className="sr-only">Restoring course progress…</span></div> : !current ? <Card><CardContent className="p-8">No lessons have been added to this course yet.</CardContent></Card> : <div className={cn('grid items-start gap-6', !focus && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
      <div className="min-w-0 space-y-5">
        <StudyVideo key={`${currentIndex}:${current.url}`} video={current} position={progress.positions[currentIndex] || 0}
          onPosition={position => update(previous => ({ ...previous, positions: { ...previous.positions, [currentIndex]: position } }))}
          onComplete={() => setCompleted(true)} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lesson {currentIndex + 1} of {videos.length}</p>
            <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none">{current.title || `Lesson ${currentIndex + 1}`}</h2></div>
          <Button variant={completed ? 'secondary' : 'outline'} size="sm" aria-pressed={completed} onClick={() => setCompleted(!completed)}><CheckCircle className="mr-2 h-4 w-4" />{completed ? 'Completed' : 'Mark as complete'}</Button>
        </div>
        <div className="flex items-center justify-between gap-3 border-b pb-5">
          <Button variant="ghost" size="sm" disabled={currentIndex === 0} onClick={() => selectLesson(currentIndex - 1)}><ArrowLeft className="mr-2 h-4 w-4" />Previous lesson</Button>
          <Button size="sm" disabled={currentIndex === videos.length - 1} onClick={() => selectLesson(currentIndex + 1)}>Next lesson<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
        {percent === 100 && <div role="status" className="rounded-xl border bg-primary/5 p-4"><p className="font-semibold">You’ve completed every lesson!</p><p className="mt-1 text-sm text-muted-foreground">Revisit any lesson or review your notes. Demo progress does not issue a certificate.</p></div>}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Lesson information" className="text-foreground/80"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="notes">My notes</TabsTrigger><TabsTrigger value="resources">Resources</TabsTrigger></TabsList>
          <TabsContent value="overview" className="space-y-4 py-4">
            <h3 className="font-semibold">About this course</h3><p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
            {specs.map(spec => <div key={spec.label}><h4 className="text-sm font-medium">{spec.label}</h4><p className="mt-1 text-sm leading-7 text-muted-foreground">{spec.value}</p></div>)}
          </TabsContent>
          <TabsContent value="notes" className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-2"><Label htmlFor="lesson-notes">Notes for this lesson</Label><Button variant="ghost" size="sm" onClick={() => update(previous => ({ ...previous, notes: { ...previous.notes, [currentIndex]: `${previous.notes[currentIndex] || ''}${previous.notes[currentIndex] ? '\n' : ''}[${formatCourseTime(previous.positions[currentIndex] || 0)}] ` } }))}>Add timestamp</Button></div>
            <Textarea id="lesson-notes" rows={7} maxLength={10000} placeholder="Capture an idea, a question, or your next step…" value={progress.notes[currentIndex] || ''} onChange={event => { const note = event.target.value; update(previous => ({ ...previous, notes: { ...previous.notes, [currentIndex]: note } })) }} />
            <p className="text-xs text-muted-foreground">Private to this browser. Notes are saved automatically; they are not synced to your account.</p>
          </TabsContent>
          <TabsContent value="resources" className="space-y-4 py-4"><h3 className="font-semibold">Practice worksheet</h3><p className="text-sm text-muted-foreground">A simple framework to put the course ideas into practice.</p>
            <Button variant="outline" asChild><a href="/course-resources/product-design-worksheet.txt" download><FileText className="mr-2 h-4 w-4" />Download worksheet</a></Button>
          </TabsContent>
        </Tabs>
      </div>
      {!focus && <aside aria-label="Course content" className="min-w-0 lg:sticky lg:top-24">
        <Card className="overflow-hidden"><CardHeader className="space-y-3"><CardTitle className="text-base">Course content</CardTitle>
          <div className="flex justify-between text-xs text-muted-foreground"><span>{progress.completedIndexes.length} of {videos.length} completed</span><span>{percent}%</span></div>
          <Progress value={percent} aria-label="Course completion" className="h-1.5" />
        </CardHeader><CardContent className="px-3 pb-3 pt-0">
          <Accordion type="multiple" value={[...new Set([...openModules, `module-${Math.floor(currentIndex / 3)}`])]} onValueChange={setOpenModules}>
            {modules.map((module, moduleIndex) => <AccordionItem key={module.id} value={module.id} className="last:border-0">
              <AccordionTrigger className="px-2 text-sm hover:no-underline"><span className="text-left">Module {moduleIndex + 1}<span className="mt-1 block text-xs font-normal text-muted-foreground">{module.lessons.length} lessons · {module.lessons.filter((_, index) => progress.completedIndexes.includes(module.start + index)).length} complete</span></span></AccordionTrigger>
              <AccordionContent><div className="space-y-1">{module.lessons.map((lesson, offset) => {
                const index = module.start + offset
                const active = index === currentIndex
                const done = progress.completedIndexes.includes(index)
                return <button key={`${index}:${lesson.url}`} type="button" aria-current={active ? 'step' : undefined} onClick={() => selectLesson(index)}
                  className={cn('flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active && 'bg-primary/5 ring-1 ring-inset ring-primary/20')}>
                  {done ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0"><span className="block text-sm font-medium">{index + 1}. {lesson.title || `Lesson ${index + 1}`}</span><span className="mt-1 block text-xs text-foreground/70">{done ? 'Completed' : active ? 'Current lesson' : 'Video lesson'}</span></span>
                </button>
              })}</div></AccordionContent>
            </AccordionItem>)}
          </Accordion>
        </CardContent></Card>
      </aside>}
    </div>}
  </div>
}