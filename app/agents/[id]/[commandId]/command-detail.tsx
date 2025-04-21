"use client"

import { useRouter, useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { 
  AlertCircle, 
  CheckCircle2, 
  PlayCircle, 
  ChevronLeft, 
  Clock, 
  FileText, 
  Info, 
  Target, 
  User,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Flag
} from "@/app/components/ui/icons"
import { JsonHighlighter } from "@/app/components/agents/json-highlighter"
import { PageTransition } from "@/app/components/ui/page-transition"
import { cn } from "@/app/lib/utils"
import { Command } from "@/app/agents/types"
import { useEffect, useState } from "react"
import React from "react"
import { useSupabase } from "@/app/hooks/use-supabase"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

// For consistent formatting of dates across the application
function formatDate(dateString: string | undefined | null) {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch (error) {
    console.error("Invalid date format:", dateString);
    return "Invalid Date";
  }
}

// Helper function to format duration in ms to human-readable format
function formatDuration(durationMs: number | undefined | null) {
  if (durationMs === undefined || durationMs === null) return "N/A";
  
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

// Component to show status with proper styling
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
          <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
          Failed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          <RotateCcw className={cn("h-3.5 w-3.5 mr-1.5 animate-spin")} />
          Running
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          Pending
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {status}
        </Badge>
      );
  }
}

function renderBase64Images(contextString: string) {
  // Buscar patrones de data:image y urls en el string
  const imageRegex = /(data:image\/[^;]+;base64,[^\s"]+)/g;
  const urlRegex = /(https?:\/\/[^\s"]+)/g;
  
  // Extraer todas las ocurrencias con sus índices
  const extractMatches = (regex: RegExp, type: string) => {
    const matches = [];
    let match;
    
    // Reiniciamos el regex para cada búsqueda
    regex.lastIndex = 0;
    
    while ((match = regex.exec(contextString)) !== null) {
      matches.push({
        type,
        value: match[0],
        index: match.index
      });
    }
    
    return matches;
  };
  
  // Extraer imágenes y urls
  const imageMatches = extractMatches(imageRegex, 'image');
  const urlMatches = extractMatches(urlRegex, 'url');
  
  // Si no hay imágenes ni URLs, devolver el string original
  if (imageMatches.length === 0 && urlMatches.length === 0) {
    return (
      <pre 
        className="text-sm whitespace-pre-wrap font-mono max-w-full overflow-x-auto break-all break-words"
        style={{ wordWrap: 'break-word', maxWidth: '100%' }}
      >{contextString}</pre>
    );
  }

  // Combinar todas las coincidencias y ordenarlas por su posición en el string
  const allMatches = [...imageMatches, ...urlMatches].sort((a, b) => a.index - b.index);
  
  // Dividir el string y procesar cada parte
  const parts = [];
  let lastIndex = 0;
  
  // Iteramos por todas las coincidencias y extraemos el texto entre ellas
  for (const match of allMatches) {
    // Encontrar la posición exacta de esta coincidencia
    const matchIndex = match.index;
    
    // Agregar el texto que aparece antes
    if (matchIndex > lastIndex) {
      parts.push({
        type: 'text',
        value: contextString.substring(lastIndex, matchIndex)
      });
    }
    
    // Agregar la coincidencia (imagen o URL)
    parts.push(match);
    
    // Actualizamos el índice para la próxima iteración
    lastIndex = matchIndex + match.value.length;
  }
  
  // Agregar cualquier texto que quede después de la última coincidencia
  if (lastIndex < contextString.length) {
    parts.push({
      type: 'text',
      value: contextString.substring(lastIndex)
    });
  }
  
  // Renderizar cada parte según su tipo
  return (
    <div className="space-y-4">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {/* Texto normal */}
          {part.type === 'text' && part.value.trim() && (
            <pre 
              className="text-sm whitespace-pre-wrap font-mono max-w-full overflow-x-auto break-all break-words"
              style={{ wordWrap: 'break-word', maxWidth: '100%' }}
            >{part.value}</pre>
          )}
          
          {/* Imágenes */}
          {part.type === 'image' && (
            <div className="my-4 flex flex-col items-center">
              <img 
                src={part.value} 
                alt={`Embedded image ${i + 1}`} 
                className="max-w-full rounded-md border border-border shadow-sm"
                style={{ maxHeight: '500px' }}
              />
              <span className="text-xs text-muted-foreground mt-2">Embedded image {i + 1}</span>
            </div>
          )}
          
          {/* URLs - no incluimos las que coincidan con el formato de imagen */}
          {part.type === 'url' && !part.value.startsWith('data:image') && (
            <div className="my-2">
              <a 
                href={part.value} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline break-all text-sm"
              >
                {part.value}
              </a>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// Función para detectar, procesar y renderizar contenido mixto con CSV
function renderCSVTable(content: string) {
  // Log de depuración inicial
  console.log("Procesando contenido para renderizado:", { 
    length: content.length,
    hasCommas: content.includes(','),
    linesCount: content.split('\n').length
  });
  
  // Verificar si hay un bloque de código CSV
  if (content.includes('```csv') && content.includes('```')) {
    try {
      // Extraer y procesar bloques de código CSV
      const parts = [];
      let lastIndex = 0;
      const codeBlockRegex = /```csv\s*([\s\S]*?)```/g;
      let match;
      
      while ((match = codeBlockRegex.exec(content)) !== null) {
        // Agregar el texto antes del bloque CSV
        if (match.index > lastIndex) {
          const textBefore = content.substring(lastIndex, match.index);
          parts.push({
            type: 'text',
            content: textBefore
          });
        }
        
        // Procesar y agregar el bloque CSV
        const csvContent = match[1].trim();
        parts.push({
          type: 'csv',
          content: csvContent
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      // Agregar cualquier texto restante después del último bloque CSV
      if (lastIndex < content.length) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex)
        });
      }
      
      // Si encontramos bloques CSV, renderizamos el contenido mixto
      if (parts.length > 0) {
        return (
          <div className="space-y-4">
            {parts.map((part, index) => (
              <div key={index}>
                {part.type === 'text' ? (
                  renderBase64Images(part.content)
                ) : (
                  processCSVContent(part.content)
                )}
              </div>
            ))}
          </div>
        );
      }
    } catch (error) {
      console.error("Error procesando bloques CSV:", error);
    }
  }
  
  // Si no hay bloques de código CSV o hubo un error, intentamos procesar todo como CSV
  // o caemos de nuevo a renderBase64Images si no es CSV
  return tryProcessCSVContent(content);
}

// Función helper para procesar contenido puramente CSV
function tryProcessCSVContent(content: string) {
  try {
    // Eliminar espacios en blanco al inicio y final
    const trimmedContent = content.trim();
    
    // Dividir por líneas y filtrar líneas vacías
    const lines = trimmedContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    // Más logs de depuración
    console.log("Analizando posible CSV:", {
      lines: lines.length,
      firstLine: lines.length > 0 ? lines[0] : '',
      firstFewChars: trimmedContent.substring(0, 30),
      exactMatch: trimmedContent.startsWith('Pregunta,Titulo,Respuesta')
    });
    
    // Verificar si el contenido coincide exactamente con el ejemplo proporcionado
    const hasExampleHeader = trimmedContent.includes('Pregunta,Titulo,Respuesta');
    
    // Si tenemos al menos 2 líneas y la primera es un encabezado con comas
    // O si el contenido coincide con el formato de ejemplo conocido
    if ((lines.length >= 2 && lines[0].includes(',')) || hasExampleHeader) {
      // Verificar formato de CSV básico: cada línea debe tener al menos una coma
      const linesWithCommas = lines.filter(line => line.includes(','));
      const percentageWithCommas = linesWithCommas.length / lines.length;
      
      // Si al menos 50% de las líneas tienen comas, consideramos que es un CSV
      if (percentageWithCommas >= 0.5 || hasExampleHeader) {
        console.log("CSV detectado con alta probabilidad");
        return processCSVContent(content);
      }
    }
  } catch (error) {
    console.error("Error en tryProcessCSVContent:", error);
  }
  
  // Si no parece ser CSV, usar el renderizador de imágenes y texto
  return renderBase64Images(content);
}

// Procesador específico de CSV para tablas
function processCSVContent(csvContent: string) {
  try {
    // Asegurarse de que el contenido está limpio
    const cleanContent = csvContent.trim();
    
    // Dividir por líneas y limpiar
    const lines = cleanContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    console.log("Procesando CSV:", { 
      lineCount: lines.length,
      sample: lines.slice(0, 2)
    });
    
    // Si tenemos pocas líneas, intentamos un enfoque simple pero robusto
    if (lines.length > 0 && lines.length < 100) {
      // División simple por comas para manejar el caso base
      const headers = lines[0].split(',').map(header => header.trim());
      const rows = [];
      
      // Procesar filas (si hay datos)
      if (lines.length > 1) {
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(cell => cell.trim());
          rows.push(row);
        }
      }
      
      // Renderizar la tabla si tenemos encabezados
      if (headers.length > 0) {
        return (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th 
                      key={index}
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {rows.map((row, rowIndex) => {
                  // Asegurar que cada fila tenga la cantidad correcta de celdas
                  const normalizedRow = [...row];
                  while (normalizedRow.length < headers.length) {
                    normalizedRow.push('');
                  }
                  
                  return (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-muted/30' : ''}>
                      {normalizedRow.slice(0, headers.length).map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 text-sm">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
    }
    
    // Si el enfoque simple no funciona, intentamos el enfoque más sofisticado
    return renderOriginalCSV(csvContent);

  } catch (error) {
    console.error("Error procesando CSV:", error);
    
    // En caso de error, mostrar el contenido como texto
    return (
      <pre className="text-sm whitespace-pre-wrap font-mono">
        {csvContent}
      </pre>
    );
  }
}

// Fallback a la implementación original
function renderOriginalCSV(csvContent: string) {
  try {
    const lines = csvContent.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    
    // Parser CSV más sofisticado
    const parseCSVLine = (line: string) => {
      const result = [];
      let cell = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cell);
          cell = '';
        } else {
          cell += char;
        }
      }
      
      // Añadir la última celda
      result.push(cell);
      return result.map(c => c.trim().replace(/^"|"$/g, ''));
    };
    
    // Procesar cada línea
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(parseCSVLine);
    
    // Solo proceder si tenemos encabezados y filas
    if (headers.length > 0 && rows.length > 0) {
      // Normalizar el número de columnas
      const normalizedRows = rows.map(row => {
        if (row.length === headers.length) return row;
        if (row.length < headers.length) {
          return [...row, ...Array(headers.length - row.length).fill('')];
        }
        return row.slice(0, headers.length);
      });
      
      // Renderizar la tabla
      return (
        <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th 
                    key={index}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {normalizedRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-muted/30' : ''}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-2 text-sm">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  } catch (error) {
    console.error("Error en renderOriginalCSV:", error);
  }
  
  // Si todo falla, mostrar el contenido original como texto
  return (
    <pre className="text-sm whitespace-pre-wrap font-mono">
      {csvContent}
    </pre>
  );
}

interface Performance {
  performance: number; // Bitmask: bit 0 = like (1), bit 1 = dislike (2), bit 2 = flag (4)
}

export default function CommandDetail({ command, commandId, agentName }: { command: Command | null, commandId: string, agentName: string }) {
  const router = useRouter();
  const { id: agentId } = useParams();
  const { supabase } = useSupabase();
  
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [performance, setPerformance] = useState<Performance>({ performance: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Bitmask constants
  const LIKE_BIT = 1;    // 001
  const DISLIKE_BIT = 2; // 010
  const FLAG_BIT = 4;    // 100

  // Cargar el estado inicial y suscribirse a cambios
  useEffect(() => {
    fetchCurrentPerformance();

    // Suscribirse a cambios en la tabla commands
    const channel = supabase
      .channel('command_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'commands',
          filter: `id=eq.${commandId}`
        },
        (payload) => {
          if (payload.new.performance !== undefined) {
            setPerformance({ performance: payload.new.performance });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commandId]);

  const fetchCurrentPerformance = async () => {
    try {
      const { data, error } = await supabase
        .from('commands')
        .select('performance')
        .eq('id', commandId)
        .single();

      if (error) throw error;
      if (data) {
        setPerformance({ performance: data.performance || 0 });
      }
    } catch (error) {
      console.error('Error fetching performance:', error);
    }
  };

  const handleLike = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const currentValue = performance.performance;
      const hasLike = (currentValue & LIKE_BIT) === LIKE_BIT;
      const newValue = hasLike 
        ? (currentValue & ~LIKE_BIT) 
        : (currentValue & ~DISLIKE_BIT) | LIKE_BIT;

      const { error } = await supabase
        .from('commands')
        .update({ performance: newValue })
        .eq('id', commandId);

      if (error) throw error;
      
      setPerformance({ performance: newValue });
      toast.success(hasLike ? 'Like removed' : 'Command liked');
    } catch (error) {
      console.error('Error updating like:', error);
      toast.error('Error updating like status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDislike = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const currentValue = performance.performance;
      const hasDislike = (currentValue & DISLIKE_BIT) === DISLIKE_BIT;
      const newValue = hasDislike 
        ? (currentValue & ~DISLIKE_BIT)
        : (currentValue & ~LIKE_BIT) | DISLIKE_BIT;

      const { error } = await supabase
        .from('commands')
        .update({ performance: newValue })
        .eq('id', commandId);

      if (error) throw error;
      
      setPerformance({ performance: newValue });
      toast.success(hasDislike ? 'Dislike removed' : 'Command disliked');
    } catch (error) {
      console.error('Error updating dislike:', error);
      toast.error('Error updating dislike status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlag = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const currentValue = performance.performance;
      const hasFlag = (currentValue & FLAG_BIT) === FLAG_BIT;
      const newValue = hasFlag 
        ? (currentValue & ~FLAG_BIT)
        : currentValue | FLAG_BIT;

      const { error } = await supabase
        .from('commands')
        .update({ performance: newValue })
        .eq('id', commandId);

      if (error) throw error;
      
      setPerformance({ performance: newValue });
      toast.success(hasFlag ? 'Report removed' : 'Issue reported');
    } catch (error) {
      console.error('Error updating flag:', error);
      toast.error('Error reporting issue');
    } finally {
      setIsLoading(false);
    }
  };

  // Update the page title and breadcrumb when command is loaded
  useEffect(() => {
    if (command) {
      const commandTitle = command.task || `Command #${commandId}`
      const pageTitle = agentName ? `${commandTitle} - ${agentName}` : commandTitle;
      
      // Update the page title for the browser tab
      document.title = `${pageTitle} | Commands`
      
      // Emit a custom event to update the breadcrumb with command title and agent name
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: commandTitle,
          path: window.location.pathname,
          section: 'agents',
          parent: {
            title: agentName || 'Agent', 
            path: `/agents/${command.agent_id || window.location.pathname.split('/')[2]}`
          }
        }
      })
      
      // Ensure event is dispatched after DOM is updated
      setTimeout(() => {
        window.dispatchEvent(event)
      }, 0)
    }
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Commands | Market Fit'
    }
  }, [command, commandId, agentName])

  const handleBackClick = () => {
    const pathParts = window.location.pathname.split('/')
    const agentId = pathParts[2] // Get the agent ID from the URL
    router.push(`/agents/${agentId}`);
  };

  if (!command) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] w-full">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold">Command Not Found</h2>
          <p className="text-muted-foreground mb-4">The command details could not be found. It may have been deleted.</p>
          <Button onClick={handleBackClick} variant="outline">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Commands
          </Button>
        </div>
      </div>
    );
  }

  // UI Debug Helper
  if (showDebugInfo) {
    return (
      <div className="p-6">
        <div className="p-4 mb-4 border rounded-md bg-muted">
          <h2 className="text-lg font-bold mb-2">Debug Info</h2>
          <p><strong>Agent Name Prop:</strong> {agentName || "(empty)"}</p>
          <p><strong>Agent ID from URL:</strong> {window.location.pathname.split('/')[2]}</p>
          <p><strong>Command agent_id:</strong> {command.agent_id || "(empty)"}</p>
          <Button 
            onClick={() => setShowDebugInfo(false)}
            className="mt-4"
            variant="outline"
          >
            Continue to Command Details
          </Button>
        </div>
      </div>
    );
  }

  // Componente Overview Card que estará siempre visible
  const OverviewCard = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Basic Command Information */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Command Information
            </h3>
            
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Task</p>
                  <p className="text-sm font-medium">{command.task || "N/A"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <Info className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Description</p>
                  <p className="text-sm">{command.description || "No description available"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Agent</p>
                  <p className="text-sm font-medium">{agentName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <Info className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Command ID</p>
                  <p className="text-sm font-mono">{commandId}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">User ID</p>
                  <p className="text-sm font-mono">{command.user_id || "N/A"}</p>
                </div>
              </div>

              {command.input_tokens !== undefined && command.input_tokens !== null && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-[5px]">Input Tokens</p>
                    <p className="text-sm font-medium">{command.input_tokens.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {command.output_tokens !== undefined && command.output_tokens !== null && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-[5px]">Output Tokens</p>
                    <p className="text-sm font-medium">{command.output_tokens.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Status */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                {command.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : command.status === "failed" || command.status === "cancelled" ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : command.status === "running" ? (
                  <RotateCcw className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <Clock className="h-5 w-5 text-warning" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-[5px]">Current Status</p>
                <div>
                  <StatusBadge status={command.status} />
                </div>
              </div>
            </div>
          </div>
          
          {/* Timestamps and Metrics */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Timestamps & Metrics
            </h3>
            
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center min-w-[48px]" style={{ width: '48px', height: '48px' }}>
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-[5px]">Created</p>
                  <p className="text-sm font-medium">
                    {formatDate(command.created_at)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center min-w-[48px]" style={{ width: '48px', height: '48px' }}>
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-[5px]">Updated</p>
                  <p className="text-sm font-medium">
                    {formatDate(command.updated_at)}
                  </p>
                </div>
              </div>
              
              {command.completion_date && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center min-w-[48px]" style={{ width: '48px', height: '48px' }}>
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-[5px]">Completed</p>
                    <p className="text-sm font-medium">
                      {formatDate(command.completion_date)}
                    </p>
                  </div>
                </div>
              )}
              
              {command.duration !== null && command.duration !== undefined && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center min-w-[48px]" style={{ width: '48px', height: '48px' }}>
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-[5px]">Duration</p>
                    <p className="text-sm font-medium">
                      {formatDuration(command.duration)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Model Information */}
          {command.model && (
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Model Information
              </h3>
              
              <div className="grid gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center min-w-[48px]" style={{ width: '48px', height: '48px' }}>
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-[5px]">Model</p>
                    <p className="text-sm font-medium font-mono">
                      {command.model}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Error Context (if failed) */}
          {command.status === "failed" && command.context && (
            <div className="bg-destructive/5 rounded-lg p-4 border border-destructive/30">
              <h3 className="text-sm font-medium text-destructive mb-3 uppercase tracking-wider">
                Error Details
              </h3>
              
              <div className="rounded-md bg-destructive/10 p-3 border border-destructive/20">
                <pre className="text-xs font-mono text-destructive whitespace-pre-wrap">
                  {typeof command.context === 'string' 
                    ? command.context
                    : JSON.stringify(command.context, null, 2)
                  }
                </pre>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PageTransition>
      <div className="flex-1">
        <Tabs defaultValue="results">
          <StickyHeader>
            <div className="px-16 pt-0 flex items-center justify-between h-full">
              <TabsList className="mt-0">
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="tools">Tools</TabsTrigger>
                <TabsTrigger value="execution">Execution</TabsTrigger>
                <TabsTrigger value="context">Context</TabsTrigger>
                <TabsTrigger value="agent_background">Agent Background</TabsTrigger>
              </TabsList>
              
              {/* Performance Feedback Controls */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={handleLike} 
                          disabled={isLoading}
                          className={`w-8 h-8 flex items-center justify-center rounded hover:bg-green-100 dark:hover:bg-green-900/30 ${
                            Boolean(performance.performance & LIKE_BIT)
                              ? 'text-green-500 bg-green-100 dark:bg-green-900/30' 
                              : 'text-green-500'
                          }`}
                          aria-label="Like"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {Boolean(performance.performance & LIKE_BIT) ? 'Remove like' : 'Like this command'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={handleDislike} 
                          disabled={isLoading}
                          className={`w-8 h-8 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/30 ${
                            Boolean(performance.performance & DISLIKE_BIT)
                              ? 'text-red-500 bg-red-100 dark:bg-red-900/30' 
                              : 'text-red-500'
                          }`}
                          aria-label="Dislike"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {Boolean(performance.performance & DISLIKE_BIT) ? 'Remove dislike' : 'Dislike this command'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={handleFlag} 
                          disabled={isLoading}
                          className={`w-8 h-8 flex items-center justify-center rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 ${
                            Boolean(performance.performance & FLAG_BIT)
                              ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' 
                              : 'text-amber-500'
                          }`}
                          aria-label="Report Issue"
                        >
                          <Flag className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {Boolean(performance.performance & FLAG_BIT) ? 'Remove report' : 'Report an issue'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </StickyHeader>

          <div className="px-16 py-6">
            <div className="flex flex-row space-x-6">
              {/* Left Side (60%) - Tabs Content */}
              <div className="w-[60%]">
                <TabsContent value="results" className="mt-0 p-0">
                  <Card>
                    <CardContent className="pt-6">
                      {command.results ? (
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Command Results</h3>
                          
                          {Array.isArray(command.results) ? (
                            <div className="space-y-4">
                              {command.results.map((result, index) => (
                                <div key={index} className="bg-muted/30 rounded-lg p-4 border border-border/50">
                                  <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-medium">Result {index + 1}</h4>
                                    {result.type && (
                                      <Badge variant="outline" className="bg-primary/5 text-primary/90">
                                        {result.type}
                                      </Badge>
                                    )}
                                  </div>
                                  <JsonHighlighter data={result} maxHeight="none" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                              <JsonHighlighter data={command.results} maxHeight="none" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Results Available</h3>
                          <p className="text-muted-foreground">This command has not produced any results yet.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tools" className="mt-0 p-0">
                  <Card>
                    <CardContent className="pt-6">
                      {command.tools ? (
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Tools Used</h3>
                          
                          {Array.isArray(command.tools) ? (
                            <div className="space-y-4">
                              {command.tools.map((tool, index) => (
                                <div key={index} className="bg-muted/30 rounded-lg p-4 border border-border/50">
                                  <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-sm font-medium">
                                      {tool.type === "function" && tool.function ? 
                                        tool.function.name : 
                                        (tool.name || `Tool ${index + 1}`)}
                                    </h4>
                                    {(tool.version || (tool.function && tool.function.version)) && (
                                      <Badge variant="outline" className="bg-primary/5 text-primary/90">
                                        v{tool.version || tool.function.version}
                                      </Badge>
                                    )}
                                  </div>
                                  {(tool.description || (tool.function && tool.function.description)) && (
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {tool.description || tool.function.description}
                                    </p>
                                  )}
                                  <div className="mt-3">
                                    <JsonHighlighter data={tool} maxHeight="none" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                              <JsonHighlighter data={command.tools} maxHeight="none" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Tools Information</h3>
                          <p className="text-muted-foreground">This command has no tools information available.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="execution" className="mt-0 p-0">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-6">
                        <h3 className="text-lg font-medium">Model Completion</h3>
                        
                        {/* Functions Information */}
                        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                            Functions
                          </h3>
                          
                          {command.functions ? (
                            <div className="space-y-4">
                              {Array.isArray(command.functions) ? (
                                command.functions.map((func, index) => (
                                  <div key={index} className="bg-background rounded-md p-3 border border-border/50">
                                    <div className="flex justify-between items-center mb-2">
                                      <h4 className="text-sm font-medium">
                                        {func.id || `Function Call ${index + 1}`}
                                      </h4>
                                      {func.status && (
                                        <Badge variant="outline" className={cn(
                                          "bg-primary/5 text-primary/90",
                                          func.status === "completed" && "bg-success/10 text-success border-success/30",
                                          func.status === "failed" && "bg-destructive/10 text-destructive border-destructive/30",
                                          func.status === "initialized" && "bg-muted text-muted-foreground"
                                        )}>
                                          {func.status}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {func.type === "function" && func.function && (
                                      <div className="mb-3 bg-muted/30 p-3 rounded-md">
                                        <div className="flex justify-between items-center">
                                          <h5 className="text-sm font-medium">
                                            {func.function.name}
                                          </h5>
                                        </div>
                                        
                                        {func.function.arguments && (
                                          <div className="mt-2">
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Arguments</p>
                                            <pre className="text-xs font-mono bg-background p-2 rounded border border-border/50 overflow-x-auto">
                                              {typeof func.function.arguments === 'string' 
                                                ? JSON.stringify(JSON.parse(func.function.arguments), null, 2)
                                                : JSON.stringify(func.function.arguments, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    <JsonHighlighter data={func} maxHeight="none" />
                                  </div>
                                ))
                              ) : (
                                <div className="bg-background rounded-md p-3 border border-border/50">
                                  <JsonHighlighter data={command.functions} maxHeight="none" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                              <p className="text-muted-foreground">No function calls were required for this command</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Targets Information */}
                        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                            Execution Targets
                          </h3>
                          
                          {command.targets ? (
                            <div className="space-y-4">
                              {Array.isArray(command.targets) ? (
                                command.targets.map((target, index) => (
                                  <div key={index} className="bg-background rounded-md p-3 border border-border/50">
                                    <div className="flex justify-between items-center mb-2">
                                      <h4 className="text-sm font-medium">
                                        {target.type || "Target"} {target.id ? `- ${target.id}` : index + 1}
                                      </h4>
                                      {target.status && (
                                        <Badge variant="outline" className={cn(
                                          "bg-primary/5 text-primary/90",
                                          target.status === "completed" && "bg-success/10 text-success border-success/30",
                                          target.status === "failed" && "bg-destructive/10 text-destructive border-destructive/30"
                                        )}>
                                          {target.status}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {target.function && (
                                      <div className="mb-3 bg-muted/30 p-3 rounded-md">
                                        <div className="flex justify-between items-center">
                                          <h5 className="text-sm font-medium">
                                            {target.function.name}
                                          </h5>
                                        </div>
                                        
                                        {target.function.arguments && (
                                          <div className="mt-2">
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Arguments</p>
                                            <pre className="text-xs font-mono bg-background p-2 rounded border border-border/50 overflow-x-auto">
                                              {typeof target.function.arguments === 'string' 
                                                ? JSON.stringify(JSON.parse(target.function.arguments), null, 2)
                                                : JSON.stringify(target.function.arguments, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    <JsonHighlighter data={target} maxHeight="none" />
                                  </div>
                                ))
                              ) : (
                                <div className="bg-background rounded-md p-3 border border-border/50">
                                  <JsonHighlighter data={command.targets} maxHeight="none" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                              <p className="text-muted-foreground">No target information available</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Supervisor Information */}
                        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                            Supervisor Information
                          </h3>
                          
                          {command.supervisor ? (
                            <div className="bg-background rounded-md p-3 border border-border/50">
                              <JsonHighlighter data={command.supervisor} maxHeight="none" />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                              <p className="text-muted-foreground">No supervisor information available</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="context" className="mt-0 p-0">
                  <Card className="w-full">
                    <CardContent className="pt-6">
                      {command.context ? (
                        <div className="space-y-4 w-full">
                          <h3 className="text-lg font-medium">Command Context</h3>
                          
                          <div 
                            className="bg-muted/30 rounded-lg p-4 border border-border/50 max-w-full overflow-x-auto break-all break-words" 
                            style={{ wordWrap: 'break-word', maxWidth: '100%' }}
                          >
                            {typeof command.context === 'string' ? (
                              renderBase64Images(command.context)
                            ) : (
                              <div className="max-w-full overflow-x-auto break-all break-words" style={{ wordWrap: 'break-word', maxWidth: '100%' }}>
                                <JsonHighlighter data={command.context} maxHeight="none" />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Info className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Context Available</h3>
                          <p className="text-muted-foreground">This command has no context information available.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="agent_background" className="mt-0 p-0">
                  <Card className="w-full">
                    <CardContent className="pt-6">
                      {command.agent_background ? (
                        <div className="space-y-4 w-full">
                          <h3 className="text-lg font-medium">Agent Background</h3>
                          
                          <div 
                            className="bg-muted/30 rounded-lg p-4 border border-border/50 max-w-full overflow-x-auto break-all break-words" 
                            style={{ wordWrap: 'break-word', maxWidth: '100%' }}
                          >
                            {typeof command.agent_background === 'string' ? (
                              renderCSVTable(command.agent_background)
                            ) : (
                              <div className="max-w-full overflow-x-auto break-all break-words" style={{ wordWrap: 'break-word', maxWidth: '100%' }}>
                                <JsonHighlighter data={command.agent_background} maxHeight="none" />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Info className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Agent Background Available</h3>
                          <p className="text-muted-foreground">This command has no agent background information available.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
              
              {/* Right Side (40%) - Overview Always Visible */}
              <div className="w-[40%]">
                <div className="sticky top-[160px]">
                  <OverviewCard />
                </div>
              </div>
            </div>
          </div>
        </Tabs>
      </div>
    </PageTransition>
  );
} 