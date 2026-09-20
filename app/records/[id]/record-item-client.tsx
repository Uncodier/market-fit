"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import HardBreak from "@tiptap/extension-hard-break"
import LinkExtension from "@tiptap/extension-link"
import ImageExtension from "@tiptap/extension-image"
import { useDebounce } from "use-debounce"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { markdownToHTML } from "@/app/content/utils"
import { deleteRecord, getRecordById, updateRecord, type RecordItem } from "../actions"
import {
  areRecordDiagramDraftsEqual,
  emptyRecordDiagram,
  recordDiagramDraftSchema,
  type RecordDiagramDraft,
  type RecordDiagramViewport,
} from "../lib/record-diagram"
import { getRecordDiagram, saveRecordDiagram } from "./diagram-actions"
import { RecordDetailSkeleton } from "./components/RecordDetailSkeleton"
import { RecordDocumentView } from "./components/RecordDocumentView"
import { RecordRightPanel } from "./components/RecordRightPanel"
import { RecordToolbar } from "./components/RecordToolbar"
import {
  RecordDiagramView,
  type RecordDiagramEditorHandle,
  type RecordDiagramEditState,
} from "./components/record-diagram/RecordDiagramView"
import { RecordDiagramEditControls } from "./components/record-diagram/RecordDiagramEditControls"
import { RecordNodeMarkdownControls } from "./components/record-diagram/RecordNodeMarkdownControls"
import { htmlToMarkdown } from "./record-markdown"
import "@/app/content/styles/editor.css"

export default function RecordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useLocalization()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [record, setRecord] = useState<RecordItem | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("draft")
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [relationsData, setRelationsData] = useState<Record<string, any>>({})
  const [diagram, setDiagram] = useState<RecordDiagramDraft>(emptyRecordDiagram)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveFailure, setSaveFailure] = useState<"error" | "conflict" | null>(null)
  const [documentDirty, setDocumentDirty] = useState(false)
  const [diagramDirty, setDiagramDirty] = useState(false)
  const [activeView, setActiveView] = useState<"document" | "nodes">("document")
  const [activeRightTab, setActiveRightTab] = useState<"insights" | "relations">("insights")
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [debouncedTitle] = useDebounce(title, 500)
  const [debouncedFormData] = useDebounce(formData, 500)
  const blurTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined)
  const loadSequenceRef = React.useRef(0)
  const hydratedRecordIdRef = React.useRef<string | null>(null)
  const activeRecordIdRef = React.useRef<string | null>(null)
  const documentVersionRef = React.useRef(0)
  const diagramVersionRef = React.useRef(0)
  const latestViewportRef = React.useRef<RecordDiagramViewport>({ x: 0, y: 0, zoom: 1 })
  const savedDiagramRef = React.useRef<RecordDiagramDraft>(emptyRecordDiagram())
  const diagramEditorRef = React.useRef<RecordDiagramEditorHandle>(null)
  const [diagramEditState, setDiagramEditState] = useState<RecordDiagramEditState>({
    canUndo: false,
    canRedo: false,
    hasSelection: false,
    canPaste: false,
    isEditingNodeContent: false,
  })
  const handleDiagramEditStateChange = useCallback((next: RecordDiagramEditState) => {
    setDiagramEditState((current) => (
      current.canUndo === next.canUndo
      && current.canRedo === next.canRedo
      && current.hasSelection === next.hasSelection
      && current.canPaste === next.canPaste
      && current.isEditingNodeContent === next.isEditingNodeContent
        ? current
        : next
    ))
  }, [])
  const handleDiagramChange = useCallback((next: RecordDiagramDraft) => {
    diagramVersionRef.current += 1
    setSaveFailure((current) => current === "conflict" ? current : null)
    setDiagram(next)
    setDiagramDirty(!areRecordDiagramDraftsEqual(next, savedDiagramRef.current))
  }, [])

  const markDocumentDirty = useCallback(() => {
    documentVersionRef.current += 1
    setSaveFailure((current) => current === "conflict" ? current : null)
    setDocumentDirty(true)
  }, [])
  const markDiagramDirty = useCallback(() => {
    diagramVersionRef.current += 1
    setSaveFailure((current) => current === "conflict" ? current : null)
    setDiagramDirty(true)
  }, [])

  const handleEditorUpdate = useCallback(({ editor: currentEditor }: { editor: Editor }) => {
    setDescription(htmlToMarkdown(currentEditor.getHTML()))
    markDocumentDirty()
  }, [markDocumentDirty])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ hardBreak: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      HardBreak.configure({
        keepMarks: true,
        HTMLAttributes: { class: "markdown-line-break" },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      ImageExtension.configure({ inline: true, allowBase64: true }),
    ],
    content: "",
    onFocus: () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
      setIsEditorFocused(true)
    },
    onBlur: () => {
      blurTimeoutRef.current = setTimeout(() => setIsEditorFocused(false), 150)
    },
    onUpdate: handleEditorUpdate,
    editorProps: {
      attributes: {
        class: "prose-lg prose-headings:my-4 prose-p:my-3 prose-ul:my-3 outline-none !min-h-0 flex-1",
      },
    },
  })

  const loadRecord = useCallback(async (recordId: string) => {
    const loadSequence = ++loadSequenceRef.current
    setIsLoading(true)
    const [recordResult, diagramResult] = await Promise.all([
      getRecordById(recordId),
      getRecordDiagram(recordId),
    ])
    if (loadSequence !== loadSequenceRef.current) return

    if (recordResult.error || !recordResult.record) {
      toast.error(recordResult.error || "Record not found")
      router.push("/records")
      setIsLoading(false)
      return
    }

    const nextRecord = recordResult.record
    activeRecordIdRef.current = nextRecord.id
    setRecord(nextRecord)
    setTitle(nextRecord.title || "")
    setDescription(nextRecord.description || "")
    setStatus(nextRecord.status || "draft")
    setFormData(nextRecord.data || {})
    setRelationsData(nextRecord.relations || {})
    const nextDiagram = diagramResult.diagram || emptyRecordDiagram()
    setDiagram(nextDiagram)
    savedDiagramRef.current = nextDiagram
    latestViewportRef.current = nextDiagram.viewport
    if (diagramResult.error) toast.error(diagramResult.error)
    documentVersionRef.current = 0
    diagramVersionRef.current = 0
    setSaveFailure(null)
    setDocumentDirty(false)
    setDiagramDirty(false)
    setIsLoading(false)
  }, [router])

  useEffect(() => {
    if (id) void loadRecord(id)
  }, [id, loadRecord])

  useEffect(() => {
    if (editor && record && hydratedRecordIdRef.current !== record.id) {
      editor.commands.setContent(markdownToHTML(record.description || ""), {
        emitUpdate: false,
      })
      hydratedRecordIdRef.current = record.id
    }
  }, [editor, record])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("breadcrumb:update", {
      detail: {
        title: debouncedTitle || (isLoading ? (t("common.loading") || "Loading...") : "Record"),
        parentTitle: "Records",
        parentPath: "/records",
      },
    }))
  }, [debouncedTitle, isLoading, t])

  const handleSave = useCallback(async () => {
    if (!record || isSaving || (!documentDirty && !diagramDirty)) return
    const diagramAtSave = { ...diagram, viewport: latestViewportRef.current }
    if (diagramDirty) {
      const validation = recordDiagramDraftSchema.safeParse(diagramAtSave)
      if (!validation.success) {
        toast.error(validation.error.issues[0]?.message || "Fix the diagram before saving")
        return
      }
    }
    const recordIdAtSave = record.id
    const documentVersionAtSave = documentVersionRef.current
    const diagramVersionAtSave = diagramVersionRef.current
    let failure: "error" | "conflict" = "error"
    setSaveFailure(null)
    setIsSaving(true)

    const promise = (async () => {
      if (documentDirty) {
        const result = await updateRecord(record.id, {
          title,
          description,
          status,
          data: formData,
          relations: relationsData,
        })
        if (result.error) throw new Error(result.error)
        if (
          activeRecordIdRef.current === recordIdAtSave
          && documentVersionRef.current === documentVersionAtSave
        ) {
          setDocumentDirty(false)
        }
      }

      if (diagramDirty) {
        const result = await saveRecordDiagram({
          recordId: record.id,
          diagram: diagramAtSave,
        })
        if (!result.success) {
          if (result.conflict) {
            failure = "conflict"
            throw new Error("The diagram changed elsewhere. Reload before saving again.")
          }
          throw new Error(result.error)
        }
        if (activeRecordIdRef.current === recordIdAtSave) {
          savedDiagramRef.current = { ...diagramAtSave, revision: result.revision }
          setDiagram((current) => ({ ...current, revision: result.revision }))
          if (diagramVersionRef.current === diagramVersionAtSave) {
            setDiagramDirty(false)
          }
        }
      }

    })()

    toast.promise(promise, {
      loading: t("common.saving") || "Saving...",
      success: t("common.saved") || "Record saved",
      error: (error) => error instanceof Error ? error.message : "Failed to save record",
    })
    try {
      await promise
    } catch {
      setSaveFailure(failure)
      // The toast above presents the actionable error to the user.
    } finally {
      setIsSaving(false)
    }
  }, [
    record,
    isSaving,
    documentDirty,
    diagramDirty,
    title,
    description,
    status,
    formData,
    relationsData,
    diagram,
    t,
  ])

  const handleViewportChange = useCallback((viewport: RecordDiagramViewport) => {
    latestViewportRef.current = viewport
    markDiagramDirty()
  }, [markDiagramDirty])

  useEffect(() => {
    const save = () => void handleSave()
    window.addEventListener("records:save", save)
    return () => window.removeEventListener("records:save", save)
  }, [handleSave])

  useEffect(() => {
    if (!documentDirty && !diagramDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const warnBeforeInternalNavigation = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]")
      if (!anchor) return
      const destination = new URL(anchor.getAttribute("href") || "", window.location.href)
      if (
        destination.origin === window.location.origin
        && destination.pathname === window.location.pathname
        && destination.search === window.location.search
      ) return
      if (!window.confirm("Discard your unsaved changes?")) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", warnBeforeUnload)
    document.addEventListener("click", warnBeforeInternalNavigation, true)
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload)
      document.removeEventListener("click", warnBeforeInternalNavigation, true)
    }
  }, [diagramDirty, documentDirty])

  const handleDelete = async () => {
    if (!record) return
    const result = await deleteRecord(record.id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Record deleted")
    router.push("/records")
  }

  if (isLoading) return <RecordDetailSkeleton />
  if (!record) return null

  const hasChanges = documentDirty || diagramDirty

  return (
    <div className="flex h-[calc(100vh-64px)] min-h-0 bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col bg-muted/10">
        <RecordToolbar
          editor={editor}
          activeView={activeView}
          hasChanges={hasChanges}
          isSaving={isSaving}
          saveStatus={
            isSaving
              ? "saving"
              : saveFailure || (hasChanges ? "unsaved" : "saved")
          }
          isEditorFocused={isEditorFocused}
          isRightPanelOpen={isRightPanelOpen}
          onSave={() => void handleSave()}
          onReload={() => {
            if (
              id
              && window.confirm("Reload this record and discard your unsaved local changes?")
            ) void loadRecord(id)
          }}
          onDelete={() => void handleDelete()}
          onToggleRightPanel={() => setIsRightPanelOpen((open) => !open)}
          saveLabel={isSaving ? (t("common.saving") || "Saving...") : (t("common.save") || "Save")}
          isNodeTextEditing={activeView === "nodes" && diagramEditState.isEditingNodeContent}
          diagramControls={activeView === "nodes" ? (
            diagramEditState.isEditingNodeContent ? (
              <RecordNodeMarkdownControls
                onFormat={(command) => diagramEditorRef.current?.formatNodeContent(command)}
              />
            ) : (
              <RecordDiagramEditControls
                canUndo={diagramEditState.canUndo}
                canRedo={diagramEditState.canRedo}
                hasSelection={diagramEditState.hasSelection}
                canPaste={diagramEditState.canPaste}
                background={diagram.viewport.background || "dots"}
                onUndo={() => diagramEditorRef.current?.undo()}
                onRedo={() => diagramEditorRef.current?.redo()}
                onCopy={() => diagramEditorRef.current?.copy()}
                onPaste={() => diagramEditorRef.current?.paste()}
                onDuplicate={() => diagramEditorRef.current?.duplicate()}
                onDelete={() => diagramEditorRef.current?.deleteSelection()}
                onLayout={(layout) => diagramEditorRef.current?.applyLayout(layout)}
                onBackground={(background) => diagramEditorRef.current?.setBackground(background)}
              />
            )
          ) : undefined}
        />

        <div className="relative min-h-0 flex-1">
          <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2">
            <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "document" | "nodes")}>
              <TabsList className="pointer-events-auto grid w-[220px] grid-cols-2 border border-border/40 bg-background/35 shadow-sm backdrop-blur-md">
                <TabsTrigger
                  value="document"
                  className="data-[state=active]:bg-background/75"
                >
                  Document
                </TabsTrigger>
                <TabsTrigger
                  value="nodes"
                  className="data-[state=active]:bg-background/75"
                >
                  Canvas
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="h-full">
            <div className={activeView === "document" ? "h-full pt-14" : "hidden"}>
              <RecordDocumentView
                editor={editor}
                record={record}
                title={title}
                status={status}
                formData={formData}
                relationsData={relationsData}
                onTitleChange={(value) => {
                  setTitle(value)
                  markDocumentDirty()
                }}
                onFieldChange={(field, value, type) => {
                  if (type === "field") {
                    setFormData((current) => ({ ...current, [field]: value }))
                  } else {
                    setRelationsData((current) => ({ ...current, [field]: value }))
                  }
                  markDocumentDirty()
                }}
                onStatusChange={(value) => {
                  setStatus(value)
                  markDocumentDirty()
                }}
              />
            </div>
            <div className={activeView === "nodes" ? "h-full" : "hidden"}>
              <RecordDiagramView
                ref={diagramEditorRef}
                key={record.id}
                diagram={diagram}
                active={activeView === "nodes"}
                onEditStateChange={handleDiagramEditStateChange}
                onChange={handleDiagramChange}
                onViewportChange={handleViewportChange}
                onViewportCommit={(viewport) => {
                  setDiagram((current) => {
                    const next = { ...current, viewport }
                    setDiagramDirty(!areRecordDiagramDraftsEqual(next, savedDiagramRef.current))
                    return next
                  })
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {isRightPanelOpen && (
        <RecordRightPanel
          activeTab={activeRightTab}
          record={record}
          formData={debouncedFormData}
          description={description}
          relationsData={relationsData}
          onTabChange={setActiveRightTab}
        />
      )}
    </div>
  )
}
