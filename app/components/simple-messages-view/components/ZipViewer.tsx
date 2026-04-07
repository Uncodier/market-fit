"use client"

import React, { useState, useEffect, useMemo } from 'react'
import JSZip from 'jszip'
import { Folder, FileText, ChevronRight, ChevronDown, Download, Loader, Archive } from '@/app/components/ui/icons'

interface ZipViewerProps {
  url: string
  isDarkMode?: boolean
}

interface FileNode {
  name: string
  path: string
  isDir: boolean
  content?: string
  children: Record<string, FileNode>
}

export const ZipViewer: React.FC<ZipViewerProps & { className?: string }> = ({ url, isDarkMode = false, className }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/']))
  const [rawZip, setRawZip] = useState<Blob | null>(null)

  useEffect(() => {
    const fetchAndParseZip = async () => {
      setLoading(true)
      setError(null)
      try {
        // Construir la URL completa correctamente asegurando que sea un GET normal
        // Eliminar transformaciones en la url que pudieran dañar la firma si las tiene
        let finalUrl = url;
        if (url.startsWith('/')) {
            finalUrl = window.location.origin + url;
        }

        // Si es una URL de Supabase, usualmente viene con tokens o query params en storage
        // Dejamos la URL intacta porque supabase storage usa ?token=... a veces.
        // Solo eliminamos parámetros que el bot haya inyectado como # o parecidos
        const proxyUrl = `/api/assets/proxy-zip?url=${encodeURIComponent(finalUrl)}`
        console.log("Fetching ZIP from proxy:", proxyUrl)
        
        const response = await fetch(proxyUrl)
        
        if (!response.ok) {
          throw new Error(`Failed to download zip: ${response.statusText}`)
        }

        const blob = await response.blob()
        setRawZip(blob)
        
        const zip = new JSZip()
        const contents = await zip.loadAsync(blob)

        const rootNode: FileNode = {
          name: 'root',
          path: '/',
          isDir: true,
          children: {}
        }

        // Construir el árbol de archivos
        for (const [path, zipEntry] of Object.entries(contents.files)) {
          // Ignorar archivos ocultos o de sistema tipo .DS_Store, __MACOSX
          if (path.includes('.DS_Store') || path.includes('__MACOSX/')) {
            continue;
          }

          const parts = path.split('/').filter(p => p.length > 0)
          let currentNode = rootNode

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const isLast = i === parts.length - 1
            const isDir = zipEntry.dir ? isLast : !isLast

            if (!currentNode.children[part]) {
              currentNode.children[part] = {
                name: part,
                path: parts.slice(0, i + 1).join('/'),
                isDir,
                children: {}
              }
            }
            currentNode = currentNode.children[part]
          }

          if (!zipEntry.dir) {
            // Leer contenido de archivos de texto/código (básico)
            const ext = path.split('.').pop()?.toLowerCase()
            const textExtensions = ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'env', 'yml', 'yaml', 'xml', 'csv', 'svg']
            
            if (ext && textExtensions.includes(ext)) {
              currentNode.content = await zipEntry.async('text')
            } else {
              currentNode.content = 'Binary file or unsupported format. Please download the ZIP to view.'
            }
          }
        }

        // Simplificar la raíz si solo tiene una carpeta
        let displayRoot = rootNode
        while (
          Object.keys(displayRoot.children).length === 1 && 
          Object.values(displayRoot.children)[0].isDir
        ) {
          displayRoot = Object.values(displayRoot.children)[0]
          setExpandedDirs(prev => new Set(prev).add(displayRoot.path))
        }

        setFileTree(displayRoot)

      } catch (err) {
        console.error('Error in ZipViewer:', err)
        setError(err instanceof Error ? err.message : 'Error loading zip file')
      } finally {
        setLoading(false)
      }
    }

    if (url) {
      fetchAndParseZip()
    }
  }, [url])

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
    if (!rawZip) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(rawZip)
    a.download = url.split('/').pop() || 'download.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
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
      <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-card/50">
        <Loader size={24} className="animate-spin text-primary mb-2" />
        <span className="text-sm text-muted-foreground">Extracting ZIP archive...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center justify-between">
        <span>Error: {error}</span>
        <button onClick={() => window.open(url, '_blank')} className="px-3 py-1 bg-background rounded border text-xs hover:bg-muted">
          Try Direct Link
        </button>
      </div>
    )
  }

  if (!fileTree) return null

  return (
    <div className={`flex flex-col w-full h-full border rounded-lg overflow-hidden bg-background ${className || 'max-h-[500px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Archive size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium truncate max-w-[200px]">{url.split('/').pop()}</span>
        </div>
        <button 
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          <Download size={14} />
          <span>Download ZIP</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden min-h-[300px]">
        {/* Sidebar */}
        <div className="w-1/3 min-w-[200px] border-r overflow-y-auto bg-muted/10 p-2">
          {renderTree(fileTree)}
        </div>

        {/* Main View */}
        <div className="flex-1 overflow-y-auto bg-card relative">
          {selectedFile ? (
            <div className="p-4">
              <div className="text-xs text-muted-foreground mb-4 pb-2 border-b">{selectedFile.path}</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {selectedFile.content}
              </pre>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <FileText size={32} className="mb-2 opacity-50" />
              <span className="text-sm">Select a file to view its contents</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
