import { useEffect, type Dispatch, type SetStateAction } from "react"
import JSZip from "jszip"
import { gunzipSync } from "fflate"

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  content?: string
  children: Record<string, FileNode>
}

type Setter<T> = Dispatch<SetStateAction<T>>
export function useArchiveContents({ url, setLoading, setError, setRawZip, setFileTree, setExpandedDirs }: { url: string; setLoading: Setter<boolean>; setError: Setter<string | null>; setRawZip: Setter<Blob | null>; setFileTree: Setter<FileNode | null>; setExpandedDirs: Setter<Set<string>> }) {
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
                const fileName = path.split('/').pop()?.toLowerCase() || '';
                const ext = fileName.includes('.') && fileName !== `.${fileName.split('.')[1]}` ? fileName.split('.').pop() : fileName;
                
                const textExtensions = ['txt', 'md', 'mdx', 'mdc', 'json', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs', 'html', 'css', 'scss', 'sass', 'less', 'env', 'yml', 'yaml', 'xml', 'csv', 'svg', 'sql', 'sh', 'bash', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'swift', 'kt', 'dart', 'r', 'pl', 'ini', 'cfg', 'conf', 'log', 'bat', 'gitignore', 'dockerignore', 'prettierrc', 'eslintrc', 'babelrc', 'npmrc', 'nvmrc', 'toml', 'lock', 'vue', 'svelte', 'graphql', 'gql', 'prisma', 'proto', 'dockerfile', 'makefile', 'license'];
                
                const isText = (ext && textExtensions.includes(ext)) || 
                               fileName.startsWith('.env') || 
                               fileName.startsWith('.') && textExtensions.includes(fileName.substring(1));
                
                if (isText) {
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
              const fileName = path.split('/').pop()?.toLowerCase() || '';
              const ext = fileName.includes('.') && fileName !== `.${fileName.split('.')[1]}` ? fileName.split('.').pop() : fileName;
              
              const textExtensions = ['txt', 'md', 'mdx', 'mdc', 'json', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs', 'html', 'css', 'scss', 'sass', 'less', 'env', 'yml', 'yaml', 'xml', 'csv', 'svg', 'sql', 'sh', 'bash', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'swift', 'kt', 'dart', 'r', 'pl', 'ini', 'cfg', 'conf', 'log', 'bat', 'gitignore', 'dockerignore', 'prettierrc', 'eslintrc', 'babelrc', 'npmrc', 'nvmrc', 'toml', 'lock', 'vue', 'svelte', 'graphql', 'gql', 'prisma', 'proto', 'dockerfile', 'makefile', 'license']
              
              const isText = (ext && textExtensions.includes(ext)) || 
                             fileName.startsWith('.env') || 
                             fileName.startsWith('.') && textExtensions.includes(fileName.substring(1));
              
              if (isText) {
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

}
