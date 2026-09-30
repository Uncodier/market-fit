"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { useArchiveContents, type FileNode } from "./use-archive-contents"
import { Folder, FileText, ChevronRight, ChevronDown, Download, Loader, Archive } from '@/app/components/ui/icons'
import { Skeleton } from '@/app/components/ui/skeleton'
import Editor, { loader } from '@monaco-editor/react'
import { useTheme } from '@/app/context/ThemeContext'

interface ZipViewerProps {
  url: string
  isDarkMode?: boolean
  onFileSelect?: (path: string) => void
}


export const ZipViewer: React.FC<ZipViewerProps & { className?: string }> = ({ url, isDarkMode: propIsDarkMode, className, onFileSelect }) => {
  const { isDarkMode: contextIsDarkMode } = useTheme()
  const isDarkMode = propIsDarkMode ?? contextIsDarkMode

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/']))
  const [rawZip, setRawZip] = useState<Blob | null>(null)
  const [editorFailed, setEditorFailed] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const [editedContents, setEditedContents] = useState<Record<string, string>>({})

  // Function to handle "Send changes to Agent"
  const handleSendChanges = () => {
    const changedFilesCount = Object.keys(editedContents).length;
    if (changedFilesCount === 0) return;

    // Crear un arreglo donde cada archivo modificado es un cambio distinto
    const changesArray = Object.entries(editedContents).map(([path, content]) => ({
      file: path,
      content: content
    }));

    const message = `Por favor aplica los siguientes ${changedFilesCount} cambios al contexto:\n\n\`\`\`json\n${JSON.stringify(changesArray, null, 2)}\n\`\`\``;

    window.dispatchEvent(new CustomEvent('robot:send-message', {
      detail: { text: message }
    }));

    // Clear edited state after sending
    setEditedContents({});
  }

  // Handle editor mount to add custom actions
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editor.addAction({
      id: 'send-context-to-agent',
      label: 'Añadir como contexto al agente',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: function (ed: any) {
        const selection = ed.getSelection();
        const text = ed.getModel().getValueInRange(selection);
        if (text && selectedFile) {
          const message = `Por favor analiza este fragmento de código de \`${selectedFile.path}\`:\n\n\`\`\`\n${text}\n\`\`\``;
          window.dispatchEvent(new CustomEvent('robot:send-message', {
            detail: { text: message }
          }));
        }
      }
    });
  }

  useEffect(() => {
    // Load Monaco locally to avoid CDN initialization errors
    if (typeof window !== 'undefined') {
      import('monaco-editor').then(monaco => {
        // Prevent Monaco from trying to load web workers (which causes CSP/404 [object Event] errors)
        // by providing a mock worker that silently ignores all messages.
        // Syntax highlighting will still work as it runs on the main thread.
        ;(window as any).MonacoEnvironment = {
          getWorker: function () {
            return {
              postMessage: function() {},
              terminate: function() {},
              onmessage: null,
              onerror: null,
              addEventListener: function() {},
              removeEventListener: function() {},
              dispatchEvent: function() { return true; }
            } as any;
          }
        };
        loader.config({ monaco })
        return loader.init()
      }).then(() => {
        setEditorReady(true)
      }).catch((err) => {
        console.warn('Monaco editor initialization failed, falling back to simple text view:', err)
        setEditorFailed(true)
      })
    }
  }, [])

  useArchiveContents({ url, setLoading, setError, setRawZip, setFileTree, setExpandedDirs })

  useEffect(() => {
    if (fileTree && !selectedFile) {
      const findReadme = (node: FileNode): FileNode | null => {
        if (!node.isDir && node.name.toLowerCase() === 'readme.md') {
          return node;
        }
        for (const child of Object.values(node.children)) {
          const found = findReadme(child);
          if (found) return found;
        }
        return null;
      };
      
      const readme = findReadme(fileTree);
      if (readme) {
        setSelectedFile(readme);
      }
    }
  }, [fileTree, selectedFile])

  useEffect(() => {
    if (selectedFile && onFileSelect) {
      onFileSelect(selectedFile.path);
    }
  }, [selectedFile, onFileSelect])

  const toggleDir = (path: string) => {
    const newExpanded = new Set(expandedDirs)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedDirs(newExpanded)
  }

  const handleDownload = () => {
    let finalUrl = url;
    if (url.startsWith('/')) {
        finalUrl = window.location.origin + url;
    }
    const proxyUrl = `/api/assets/proxy-zip?url=${encodeURIComponent(finalUrl)}`;
    window.open(proxyUrl, '_blank');
  }

  const renderTree = (node: FileNode, level: number = 0) => {
    const entries = Object.values(node.children).sort((a, b) => {
      // Carpetas primero, luego alfabéticamente
      if (a.isDir && !b.isDir) return -1
      if (!a.isDir && b.isDir) return 1
      return a.name.localeCompare(b.name)
    })

    return entries.map(child => {
      const isExpanded = expandedDirs.has(child.path)
      const isSelected = selectedFile?.path === child.path

      return (
        <div key={child.path} className="w-full">
          <div 
            className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer text-sm rounded hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => {
              if (child.isDir) {
                toggleDir(child.path)
              } else {
                setSelectedFile(child)
              }
            }}
          >
            {child.isDir ? (
              <div className="flex items-center gap-1.5">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={14} className="text-blue-400" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 pl-5">
                <FileText size={14} className="text-gray-400" />
              </div>
            )}
            <span className="truncate">{child.name}</span>
          </div>
          {child.isDir && isExpanded && (
            <div className="w-full">
              {renderTree(child, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  if (loading) {
    return (
      <div className={`flex flex-col w-full h-full bg-background ${className || ''}`}>
        {/* Header Skeleton */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar Skeleton */}
          <div className="w-64 min-w-[200px] border-r border-border bg-muted/10 p-2 shrink-0 flex flex-col gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1">
                <Skeleton className="h-3.5 w-3.5 rounded-sm shrink-0" />
                <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-24' : i % 3 === 0 ? 'w-32' : 'w-16'}`} />
              </div>
            ))}
          </div>

          {/* Main View Skeleton */}
          <div className="flex-1 bg-card flex flex-col p-4 gap-2">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            {[...Array(15)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground/30 w-4 text-right select-none">{i + 1}</span>
                <Skeleton 
                  className={`h-4 rounded-sm ${
                    i % 5 === 0 ? 'w-3/4' : 
                    i % 4 === 0 ? 'w-1/2' : 
                    i % 3 === 0 ? 'w-5/6' : 
                    i % 2 === 0 ? 'w-2/3' : 'w-1/3'
                  } ${i % 3 === 0 ? 'ml-4' : i % 4 === 0 ? 'ml-8' : ''}`} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center justify-between">
        <span>Error: {error}</span>
        <button 
          onClick={handleDownload}
          className="flex items-center justify-center transition-colors duration-200 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          title="Descargar Archivo"
        >
          <Download size={14} className="shrink-0" />
        </button>
      </div>
    )
  }

  if (!fileTree) return null

  return (
    <div className={`flex flex-col w-full h-full bg-background ${className || ''}`}>
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-64 min-w-[200px] border-r border-border overflow-y-auto bg-muted/10 p-2 shrink-0">
          {renderTree(fileTree)}
        </div>

        {/* Main View */}
        <div className="flex-1 overflow-y-auto bg-card relative min-w-0">
          {selectedFile ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 min-h-0 overflow-hidden relative">
                {!editorFailed && editorReady ? (
                  <div className="relative h-full">
                    <Editor
                      height="100%"
                      path={selectedFile.path}
                      theme={isDarkMode ? 'vs-dark' : 'light'}
                      value={editedContents[selectedFile.path] ?? (selectedFile.content || '')}
                      onChange={(value) => {
                        if (value !== selectedFile.content) {
                          setEditedContents(prev => ({ ...prev, [selectedFile.path]: value || '' }));
                        } else {
                          setEditedContents(prev => {
                            const next = { ...prev };
                            delete next[selectedFile.path];
                            return next;
                          });
                        }
                      }}
                      onMount={handleEditorDidMount}
                      options={{
                        readOnly: false,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        padding: { top: 16, bottom: 16 },
                        fontSize: 13,
                      }}
                      loading={
                        <div className="flex flex-col h-full bg-background p-4 gap-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          {[...Array(15)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                              <span className="text-xs text-muted-foreground/30 w-4 text-right select-none">{i + 1}</span>
                              <Skeleton 
                                className={`h-4 rounded-sm ${
                                  i % 5 === 0 ? 'w-3/4' : 
                                  i % 4 === 0 ? 'w-1/2' : 
                                  i % 3 === 0 ? 'w-5/6' : 
                                  i % 2 === 0 ? 'w-2/3' : 'w-1/3'
                                } ${i % 3 === 0 ? 'ml-4' : i % 4 === 0 ? 'ml-8' : ''}`} 
                              />
                            </div>
                          ))}
                        </div>
                      }
                    />
                  </div>
                ) : !editorFailed ? (
                  <div className="flex flex-col h-full bg-background p-4 gap-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    {[...Array(15)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground/30 w-4 text-right select-none">{i + 1}</span>
                        <Skeleton 
                          className={`h-4 rounded-sm ${
                            i % 5 === 0 ? 'w-3/4' : 
                            i % 4 === 0 ? 'w-1/2' : 
                            i % 3 === 0 ? 'w-5/6' : 
                            i % 2 === 0 ? 'w-2/3' : 'w-1/3'
                          } ${i % 3 === 0 ? 'ml-4' : i % 4 === 0 ? 'ml-8' : ''}`} 
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full overflow-auto p-4 bg-muted/10">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {selectedFile.content}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <FileText size={32} className="mb-2 opacity-50" />
              <span className="text-sm">Selecciona un archivo para ver su contenido</span>
            </div>
          )}

          {/* Global Save Button */}
          {Object.keys(editedContents).length > 0 && (
            <div className="absolute bottom-6 right-8 z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button
                onClick={handleSendChanges}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                Enviar {Object.keys(editedContents).length} {Object.keys(editedContents).length === 1 ? 'cambio' : 'cambios'} al agente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
