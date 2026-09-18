"use client"

import { useEffect, useRef, useState } from "react"
import HardBreak from "@tiptap/extension-hard-break"
import TextAlign from "@tiptap/extension-text-align"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { markdownToHTML } from "../../utils"
import type {
  ContentActiveTab,
  EditFormSetter,
} from "../content-item-types"

type Options = {
  activeTab: ContentActiveTab
  content: any
  setEditForm: EditFormSetter
  setHasUserMadeChanges: (changed: boolean) => void
}

const createExtensions = () => [
  StarterKit.configure({ hardBreak: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  HardBreak.configure({
    keepMarks: true,
    HTMLAttributes: { class: "markdown-line-break" },
  }),
]

export function useContentEditors({
  activeTab,
  content,
  setEditForm,
  setHasUserMadeChanges,
}: Options) {
  const [editorsReady, setEditorsReady] = useState(false)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const focusHandlers = {
    onFocus: () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
      setIsEditorFocused(true)
    },
    onBlur: () => {
      blurTimeoutRef.current = setTimeout(() => setIsEditorFocused(false), 150)
    },
  }

  const editor = useEditor({
    extensions: createExtensions(),
    content: "",
    ...focusHandlers,
    onUpdate: ({ editor: currentEditor }) => {
      if (activeTab !== "copy") return
      setEditForm((previous) => ({
        ...previous,
        content: currentEditor.getHTML(),
        text: currentEditor.getText(),
      }))
      if (editorsReady) setHasUserMadeChanges(true)
    },
    editorProps: {
      attributes: {
        class: "prose-lg prose-headings:my-4 prose-p:my-3 prose-ul:my-3",
      },
    },
  })

  const instructionsEditor = useEditor({
    extensions: createExtensions(),
    content: "",
    ...focusHandlers,
    onUpdate: ({ editor: currentEditor }) => {
      if (activeTab !== "instructions") return
      setEditForm((previous) => ({
        ...previous,
        instructions: currentEditor.getHTML(),
      }))
      if (editorsReady) setHasUserMadeChanges(true)
    },
    editorProps: {
      attributes: {
        class: "prose-lg prose-headings:my-4 prose-p:my-3 prose-ul:my-3",
      },
    },
  })

  useEffect(() => {
    if (editor && content && !editor.isFocused) {
      const text = content.text || content.content || ""
      if (text) editor.commands.setContent(markdownToHTML(text))
    }
    if (instructionsEditor && content && !instructionsEditor.isFocused) {
      const instructions = content.instructions || ""
      if (instructions) instructionsEditor.commands.setContent(markdownToHTML(instructions))
    }
    if (!editor || !instructionsEditor || !content || editorsReady) return

    const timer = setTimeout(() => setEditorsReady(true), 500)
    return () => clearTimeout(timer)
  }, [content, editor, instructionsEditor, editorsReady])

  useEffect(() => {
    if (!editor) return
    const updateCounts = () => {
      if (activeTab !== "copy") return
      const text = editor.getText()
      setEditForm((previous) => ({
        ...previous,
        word_count: text.trim().split(/\s+/).filter(Boolean).length,
        char_count: text.length,
        content: editor.getHTML(),
        text,
      }))
    }
    updateCounts()
    editor.on("update", updateCounts)
    return () => {
      editor.off("update", updateCounts)
    }
  }, [editor, activeTab, setEditForm])

  useEffect(() => {
    if (!instructionsEditor) return
    const updateInstructions = () => {
      if (activeTab === "instructions") {
        setEditForm((previous) => ({
          ...previous,
          instructions: instructionsEditor.getHTML(),
        }))
      }
    }
    instructionsEditor.on("update", updateInstructions)
    return () => {
      instructionsEditor.off("update", updateInstructions)
    }
  }, [instructionsEditor, activeTab, setEditForm])

  useEffect(() => () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
  }, [])

  return {
    editor,
    instructionsEditor,
    editorsReady,
    isEditorFocused,
    setEditorsReady,
  }
}
