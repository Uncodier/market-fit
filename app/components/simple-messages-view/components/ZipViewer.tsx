"use client"

import React, { useState, useEffect, useMemo } from 'react'
import JSZip from 'jszip'
import { gunzipSync } from 'fflate'
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
        
        const rootNode: FileNode = {
          name: 'root',
          path: '/',
          isDir: true,
          children: {}
        }

        // Si es un archivo tar.gz o tar, lo parseamos con fflate y tar-stream
        if (url.includes('.tar.gz') || url.endsWith('.tar.gz') || url.includes('.tar') || url.endsWith('.tar')) {
          const arrayBuffer = await blob.arrayBuffer();
          let tarBuffer = new Uint8Array(arrayBuffer);
          
          // Descomprimir si es .gz
          if (url.includes('.gz')) {
            tarBuffer = gunzipSync(tarBuffer);
          }
          
          // Importar tar-stream dinámicamente
          const tar = await import('tar-stream');
          const extract = tar.extract();
          
          return new Promise<void>((resolve, reject) => {
            extract.on('entry', (header, stream, next) => {
              const path = header.name;
              
              if (path.includes('.DS_Store') || path.includes('__MACOSX/')) {
                stream.on('end', () => next());
                stream.resume();
                return;
              }
              
              const parts = path.split('/').filter((p: string) => p.length > 0);
              let currentNode = rootNode;
              
              for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = i === parts.length - 1;
                const isDir = isLast ? (header.type === 'directory' || path.endsWith('/')) : true;
                
                if (!currentNode.children[part]) {
                  currentNode.children[part] = {
                    name: part,
                    path: parts.slice(0, i + 1).join('/'),
                    isDir,
                    children: {}
                  };
                }
                currentNode = currentNode.children[part];
              }
              
              if (header.type !== 'directory' && !path.endsWith('/')) {
                const ext = path.split('.').pop()?.toLowerCase();
                const textExtensions = ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'env', 'yml', 'yaml', 'xml', 'csv', 'svg'];
                
                if (ext && textExtensions.includes(ext)) {
                  const chunks: Uint8Array[] = [];
                  stream.on('data', (chunk) => chunks.push(chunk));
                  stream.on('end', () => {
                    try {
                      // Concatenate chunks and decode as UTF-8
                      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                      const result = new Uint8Array(totalLength);
                      let offset = 0;
                      for (const chunk of chunks) {
                        result.set(chunk, offset);
                        offset += chunk.length;
                      }
                      currentNode.content = new TextDecoder('utf-8').decode(result);
                    } catch (e) {
                      currentNode.content = 'Binary file or unsupported format. Please download the archive to view.';
                    }
                    next();
                  });
                } else {
                  currentNode.content = 'Binary file or unsupported format. Please download the archive to view.';
                  stream.on('end', () => next());
                  stream.resume();
                }
              } else {
                stream.on('end', () => next());
                stream.resume();
              }
            });
            
            extract.on('finish', () => {
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
              setLoading(false)
              resolve()
            });
            
            extract.on('error', (err) => {
              reject(err);
            });
            
            // Feed the buffer to the extractor
            extract.end(Buffer.from(tarBuffer));
          });
        } else {
          // Verificar el tipo MIME o la extensión para asegurarse de que es un ZIP
          const isZipExtension = url.includes('.zip') || url.endsWith('.zip');
          const isZipMime = blob.type === 'application/zip' || blob.type === 'application/x-zip-compressed';
          
          if (!isZipExtension && !isZipMime) {
            setError('El archivo no parece ser un formato ZIP o TAR válido. Por favor descárgalo.');
            setLoading(false);
            return;
          }
          
          const zip = new JSZip()
          const contents = await zip.loadAsync(blob)

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
              const isDir = isLast ? zipEntry.dir : true

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
                currentNode.content = 'Binary file or unsupported format. Please download the archive to view.'
              }
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
        setError(err instanceof Error ? err.message : 'Error loading archive file')
      } finally {
        setLoading(false)
      }
    }

    if (url) {
      fetchAndParseZip()
    }
  }, [url])

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
      <div className="flex flex-col items-center justify-center p-8 bg-card/50 w-full h-full">
        <Loader size={24} className="animate-spin text-primary mb-2" />
        <span className="text-sm text-muted-foreground">Extrayendo archivo...</span>
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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Archive size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{url.split('/').pop()?.split('?')[0]}</span>
        </div>
        <button 
          onClick={handleDownload}
          className="flex items-center justify-center transition-colors duration-200 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          title="Descargar Archivo"
        >
          <Download size={14} className="shrink-0" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-64 min-w-[200px] border-r border-border overflow-y-auto bg-muted/10 p-2 shrink-0">
          {renderTree(fileTree)}
        </div>

        {/* Main View */}
        <div className="flex-1 overflow-y-auto bg-card relative min-w-0">
          {selectedFile ? (
            <div className="p-4">
              <div className="text-xs text-muted-foreground mb-4 pb-2 border-b border-border">{selectedFile.path}</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {selectedFile.content}
              </pre>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <FileText size={32} className="mb-2 opacity-50" />
              <span className="text-sm">Selecciona un archivo para ver su contenido</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
