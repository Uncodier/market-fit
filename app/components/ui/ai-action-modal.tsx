"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { 
  BarChart, 
  CheckCircle2,
  XCircle,
  Globe,
  Loader,
  Copy,
  RotateCcw as RefreshCw,
  AlertTriangle,
  HelpCircle,
  Mail,
  Check
} from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { Progress } from "@/app/components/ui/progress"
import { Textarea } from "@/app/components/ui/textarea"
import { sendErrorReport } from "@/app/services/support-service"
import { checkApiConnection, diagnoseApiConnection } from "@/app/services/ai-service"
import { toast } from "sonner"
import { JsonHighlighter } from "@/app/components/agents/json-highlighter"
import { JsonDisplay } from "@/app/components/ui/json-display"

// Tipos para el estado de conexión
type ConnectionStatus = "success" | "error"

// Tipo para los detalles de conexión
type ConnectionDetails = {
  status: string
  url: string
  message?: string
  error?: string
}

export interface AIActionModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => Promise<any>; // Permitir cualquier tipo de retorno
  creditsAvailable?: number;
  creditsRequired?: number;
  icon?: React.ReactNode;
  estimatedTime?: number; // Tiempo estimado en segundos
  refreshOnComplete?: boolean;
}

// Processing messages to display during loading
const processingMessages = [
  "Initializing data analysis...",
  "Processing segment information...",
  "Applying machine learning algorithms...",
  "Identifying relevant patterns...",
  "Generating personalized insights...",
  "Optimizing results...",
  "Preparing data visualization...",
  "Finalizing process..."
];

export function AIActionModal({
  isOpen,
  setIsOpen,
  title,
  description,
  actionLabel,
  onAction,
  creditsAvailable = 0,
  creditsRequired = 1,
  icon,
  estimatedTime = 30, // Default estimated time: 30 seconds
  refreshOnComplete = false // Default: don't refresh the page
}: AIActionModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [isOvertime, setIsOvertime] = useState(false)
  const [pulseAnimation, setPulseAnimation] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false) // State to track completion
  const [isSendingReport, setIsSendingReport] = useState(false) // State to track if sending error report
  const [reportSent, setReportSent] = useState(false) // State to track if report was sent
  const [userFeedback, setUserFeedback] = useState("") // State for additional user comments
  const [apiResponse, setApiResponse] = useState<string | object | null>(null) // State to store the actual API response
  const [serverError, setServerError] = useState(false) // State to track if the error is a server error
  const [isCheckingConnection, setIsCheckingConnection] = useState(false); // Estado para verificar la conexión
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [showConnectionDetails, setShowConnectionDetails] = useState(false)
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null)
  const [showEstimatedTime, setShowEstimatedTime] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState(estimatedTime)
  const [isProcessing, setIsProcessing] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(false)
      setIsTestingConnection(false)
      setConnectionStatus(null)
      setShowConnectionDetails(false)
      setConnectionDetails(null)
      setShowEstimatedTime(true)
      setTimeRemaining(estimatedTime)
      setIsProcessing(false)
    }
  }, [isOpen, estimatedTime])

  // Effect for pulse animation
  useEffect(() => {
    if (isLoading) {
      const pulseInterval = setInterval(() => {
        setPulseAnimation(prev => !prev);
      }, 1500);
      
      return () => clearInterval(pulseInterval);
    }
  }, [isLoading]);

  // Effect to change messages during processing
  useEffect(() => {
    if (isLoading) {
      const messageInterval = setInterval(() => {
        setCurrentMessageIndex(prev => 
          prev < processingMessages.length - 1 ? prev + 1 : prev
        );
      }, Math.min(estimatedTime * 125, 5000)); // Change messages faster if estimated time is short
      
      return () => clearInterval(messageInterval);
    } else {
      setCurrentMessageIndex(0);
    }
  }, [isLoading, estimatedTime]);

  // Effect to update elapsed time and check for overtime
  useEffect(() => {
    if (isLoading) {
      const timer = setInterval(() => {
        setTimeElapsed(prev => {
          const newTime = prev + 1;
          // Check if we've exceeded the estimated time
          if (newTime > estimatedTime && !isOvertime) {
            setIsOvertime(true);
          }
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    } else {
      setTimeElapsed(0);
      setIsOvertime(false);
    }
  }, [isLoading, estimatedTime, isOvertime]);

  // Simulate progress for better UX
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          // Calculate progress based on elapsed time
          const elapsedPercentage = (timeElapsed / estimatedTime) * 100;
          
          // If we're overtime, slowly approach 95%
          if (isOvertime) {
            return Math.min(prev + 0.2, 95);
          }
          
          // Ensure progress never reaches 100% until complete
          return Math.min(elapsedPercentage, 95);
        });
      }, 200);
      
      return () => clearInterval(interval);
    } else {
      // Reset progress when not loading
      setProgress(0);
      setTimeElapsed(0);
      setIsOvertime(false);
    }
  }, [isLoading, timeElapsed, estimatedTime, isOvertime]);

  // Handle the main action
  const handleAction = async () => {
    // Evitar múltiples solicitudes simultáneas
    if (isProcessing || isLoading) {
      return;
    }
    
    try {
      setIsProcessing(true);
      setIsLoading(true);
      setError(null);
      setProgress(0);
      setTimeElapsed(0);
      setApiResponse(null);
      setUserFeedback('');
      setServerError(false);
      setIsOvertime(false);
      setIsCompleted(false); // Reset completion state
      setReportSent(false); // Reset report sent state
      
      // Capture the start time
      const startTime = Date.now();
      
      try {
        // Ejecutar la acción y capturar el resultado
        const result = await onAction();
        
        // Si la acción devuelve un resultado, lo guardamos para mostrarlo
        if (result) {
          // Si el resultado tiene una propiedad success y es false, es un error
          if (result.success === false) {
            // Si el resultado tiene una propiedad rawResponse, es un error HTML u otro tipo de respuesta no JSON
            if (result.rawResponse) {
              setApiResponse(result.rawResponse);
              // Verificar si es HTML para mostrar un mensaje más específico
              const isHtml = result.rawResponse.includes('<!DOCTYPE html>') || 
                            result.rawResponse.includes('<html>');
              
              setServerError(true);
              throw new Error(result.error || 
                (isHtml ? "Server returned an HTML response instead of JSON" : 
                        "Server returned a non-JSON response"));
            } else if (result.error && (
              result.error.includes("Cannot connect to API server") ||
              result.error.includes("Network error") ||
              result.error.includes("Connection refused")
            )) {
              // Es un error de conexión
              setApiResponse(result);
              setServerError(true);
              throw new Error(result.error);
            } else {
              // Es un error normal de la API
              setApiResponse(result);
              throw new Error(result.error || "The operation failed");
            }
          }
          
          // Guardar la respuesta de la API para mostrarla
          setApiResponse(result);
        } else {
          setApiResponse("Action executed successfully, but no response data was returned.");
        }
        
        // Calculate how long the action took
        const elapsedTimeMs = Date.now() - startTime;
        const elapsedTimeSeconds = Math.floor(elapsedTimeMs / 1000);
        
        // Set progress to 100% when complete
        setProgress(100);
        setIsCompleted(true); // Mark as completed
        
        // If the action completed before the estimated time, update the UI to reflect this
        if (elapsedTimeSeconds < estimatedTime) {
          console.log(`Action completed in ${elapsedTimeSeconds}s, before the estimated ${estimatedTime}s`);
          
          // Close modal after a short delay to show completion
          setTimeout(() => {
            setIsOpen(false);
            setIsLoading(false);
            
            // Refresh the page if requested
            if (refreshOnComplete) {
              window.location.reload();
            }
          }, 1500); // Slightly longer delay to show the completion message
        } else {
          // Close modal after a short delay to show completion (original behavior)
          setTimeout(() => {
            setIsOpen(false);
            setIsLoading(false);
            
            // Refresh the page if requested
            if (refreshOnComplete) {
              window.location.reload();
            }
          }, 1000);
        }
      } catch (err) {
        console.error("Error in AI action:", err);
        setIsLoading(false);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
        
        // Destacar si es un error de servidor (HTML)
        if (
          (err instanceof Error && 
           (err.message.includes("not valid JSON") || 
            err.message.includes("HTML") || 
            err.message.includes("Server returned") ||
            err.message.includes("Network error") ||
            err.message.includes("Cannot connect to API server") ||
            err.message.includes("Connection refused"))) ||
          (apiResponse && (
            typeof apiResponse === 'string' && (apiResponse.includes('<!DOCTYPE html>') || apiResponse.includes('<html>'))
          ))
        ) {
          setServerError(true);
        }
      }
    } catch (error) {
      console.error("Unexpected error in handleAction:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to handle sending error report
  const handleSendErrorReport = async () => {
    if (isSendingReport || reportSent || !error) return;
    
    setIsSendingReport(true);
    
    try {
      // Prepare the error report data
      const reportData = {
        error: error,
        action: title,
        timeElapsed: timeElapsed,
        apiResponse: apiResponse || "",
        userFeedback: userFeedback,
        timestamp: new Date().toISOString(),
        context: {
          estimatedTime: estimatedTime,
          isOvertime: isOvertime,
          progress: progress,
          currentStep: processingMessages[currentMessageIndex]
        }
      };
      
      // Send the error report to your support service
      await sendErrorReport(reportData);
      
      // Show success message
      toast.success("Error report sent successfully. Thank you for your feedback!");
      setReportSent(true);
    } catch (err) {
      console.error("Error sending report:", err);
      toast.error("Failed to send error report. Please try again.");
    } finally {
      setIsSendingReport(false);
    }
  };

  // Función para verificar la conexión con el servidor API
  const handleCheckConnection = async () => {
    if (isCheckingConnection) return;
    
    setIsCheckingConnection(true);
    
    try {
      // Usar la nueva función de diagnóstico
      const result = await diagnoseApiConnection();
      
      if (result.success) {
        toast.success("API server is reachable. The connection is working.");
        console.log("API diagnosis successful:", result);
      } else {
        toast.error(`Connection check failed: ${result.error}`);
        console.error("API diagnosis failed:", result);
        
        // Actualizar la respuesta de la API con el resultado del diagnóstico
        setApiResponse(result);
      }
    } catch (err) {
      console.error("Error checking API connection:", err);
      toast.error("Failed to check API connection");
      
      // Actualizar la respuesta de la API con el error
      setApiResponse({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
        details: {
          message: err instanceof Error ? err.message : String(err),
          name: err instanceof Error ? err.name : 'Unknown Error'
        }
      });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Función para probar la conexión directamente
  const handleDirectConnectionTest = async () => {
    if (isTestingConnection) return;
    
    setIsTestingConnection(true);
    setConnectionStatus(null);
    setConnectionDetails(null);
    setShowConnectionDetails(false);
    
    try {
      // Llamar a la función de diagnóstico de conexión
      const result = await diagnoseApiConnection();
      
      // Actualizar el estado con los resultados
      if (result.success) {
        setConnectionStatus("success");
        setConnectionDetails({
          status: "Connected",
          url: "API Server",
          message: "Connection successful"
        });
        toast.success("Connection test successful!");
      } else {
        setConnectionStatus("error");
        setConnectionDetails({
          status: "Failed",
          url: "API Server",
          error: result.error || "Unknown error"
        });
        toast.error("Connection test failed: " + (result.error || "Unknown error"));
      }
      
      // Actualizar la respuesta de la API con el resultado de la prueba de conexión
      setApiResponse({
        status: "success",
        message: "Connection test successful",
        details: result
      });
    } catch (error) {
      console.error("Error in direct connection test:", error);
      setConnectionStatus("error");
      setConnectionDetails({
        status: "Error",
        url: "API Server",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      toast.error("Failed to perform direct connection test");
      
      // Actualizar la respuesta de la API con el error de la prueba de conexión
      setApiResponse({
        status: "error",
        message: "Connection test failed",
        details: error instanceof Error ? {
          message: error.message,
          name: error.name
        } : {
          message: String(error),
          name: "UnknownError"
        }
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Función para probar la conexión usando un iframe
  const handleIframeTest = () => {
    if (isCheckingConnection) return;
    
    setIsCheckingConnection(true);
    
    try {
      // Extraer la URL del API del error o usar la predeterminada
      let apiUrl = "http://localhost:3001";
      if (apiResponse) {
        try {
          const parsedResponse = typeof apiResponse === 'string' ? JSON.parse(apiResponse) : apiResponse;
          if (parsedResponse.apiUrl) {
            apiUrl = parsedResponse.apiUrl;
          }
        } catch (e) {
          console.error("Error parsing API response:", e);
        }
      }
      
      // Obtener las credenciales de API (en un entorno real, estas vendrían de una fuente segura)
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "YOUR_API_KEY";
      const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || "YOUR_API_SECRET";
      
      // Crear un iframe oculto
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      // Configurar un timeout para el iframe
      const timeoutId = setTimeout(() => {
        document.body.removeChild(iframe);
        toast.error("Iframe test timed out after 5 seconds");
        setApiResponse({
          status: "error",
          message: "Iframe test timed out after 5 seconds",
          details: {
            message: "Request timed out",
            name: "TimeoutError",
            possibleCause: "Server is not responding or not serving HTML content"
          }
        });
        setIsCheckingConnection(false);
      }, 5000);
      
      // Manejar la carga del iframe
      iframe.onload = () => {
        clearTimeout(timeoutId);
        
        try {
          // Intentar acceder al contenido del iframe (esto fallará si hay problemas de CORS)
          const iframeContent = iframe.contentWindow?.document.body.innerHTML;
          
          toast.success("Iframe loaded successfully!");
          setApiResponse({
            status: "success",
            message: "Iframe test successful - server is responding with HTML content",
            details: {
              url: apiUrl,
              width: iframe.width,
              height: iframe.height,
              contentPreview: iframeContent ? iframeContent.substring(0, 100) + "..." : "Content not accessible due to CORS"
            }
          });
        } catch (corsError) {
          console.error("CORS error accessing iframe content:", corsError);
          toast.warning("Iframe loaded but content is not accessible due to CORS");
          setApiResponse({
            status: "success",
            message: "Server is responding, but content is not accessible due to CORS",
            details: {
              url: apiUrl,
              message: "Content is not accessible due to CORS",
              error: corsError instanceof Error ? corsError.message : "CORS restriction"
            }
          });
        }
        
        document.body.removeChild(iframe);
        setIsCheckingConnection(false);
      };
      
      // Manejar errores del iframe
      iframe.onerror = () => {
        clearTimeout(timeoutId);
        document.body.removeChild(iframe);
        
        toast.error("Failed to load iframe");
        setApiResponse({
          status: "error",
          message: "Failed to load iframe. The server might be down or not serving HTML content.",
          details: {
            message: "Iframe load error",
            name: "IframeError",
            possibleCause: "Server not running or not serving HTML content"
          }
        });
        
        setIsCheckingConnection(false);
      };
      
      // Cargar la URL en el iframe con las credenciales de API como parámetros de consulta
      // Nota: Esto es solo para pruebas, en producción no se deben exponer las credenciales en la URL
      iframe.src = `${apiUrl}?x-api-key=${encodeURIComponent(apiKey)}&x-api-secret=${encodeURIComponent(apiSecret)}`;
      console.log("Iframe test started with URL:", apiUrl);
      
    } catch (err) {
      console.error("Error in iframe test:", err);
      toast.error("Failed to perform iframe test");
      setIsCheckingConnection(false);
    }
  };

  // Función para probar la conexión usando una imagen (ping)
  const handleImagePingTest = () => {
    if (isCheckingConnection) return;
    
    setIsCheckingConnection(true);
    
    try {
      // Extraer la URL del API del error o usar la predeterminada
      let apiUrl = "http://localhost:3001";
      if (apiResponse) {
        try {
          const parsedResponse = typeof apiResponse === 'string' ? JSON.parse(apiResponse) : apiResponse;
          if (parsedResponse.apiUrl) {
            apiUrl = parsedResponse.apiUrl;
          }
        } catch (e) {
          console.error("Error parsing API response:", e);
        }
      }
      
      // Obtener las credenciales de API (en un entorno real, estas vendrían de una fuente segura)
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "YOUR_API_KEY";
      const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || "YOUR_API_SECRET";
      
      // Crear una URL para la imagen de favicon o similar
      // Incluir las credenciales de API como parámetros de consulta
      // Nota: Esto es solo para pruebas, en producción no se deben exponer las credenciales en la URL
      const imgUrl = `${apiUrl}/favicon.ico?x-api-key=${encodeURIComponent(apiKey)}&x-api-secret=${encodeURIComponent(apiSecret)}`;
      console.log("Testing ping with image URL:", imgUrl);
      
      // Crear una imagen para el ping
      const img = new Image();
      
      // Configurar un timeout
      const timeoutId = setTimeout(() => {
        toast.error("Image ping timed out after 5 seconds");
        setApiResponse({
          status: "error",
          message: "Image ping timed out after 5 seconds",
          details: {
            message: "Request timed out",
            name: "TimeoutError",
            possibleCause: "Server is not responding or the resource doesn't exist"
          }
        });
        setIsCheckingConnection(false);
      }, 5000);
      
      // Manejar la carga exitosa
      img.onload = () => {
        clearTimeout(timeoutId);
        toast.success("Server is reachable! Image loaded successfully.");
        setApiResponse({
          status: "success",
          message: "Server is reachable. Image ping test successful.",
          details: {
            url: imgUrl,
            width: img.width,
            height: img.height
          }
        });
        setIsCheckingConnection(false);
      };
      
      // Manejar errores
      img.onerror = () => {
        clearTimeout(timeoutId);
        toast.error("Image ping failed. Server might be down or resource not found.");
        setApiResponse({
          status: "error",
          message: "Image ping failed. Server might be down or resource not found.",
          details: {
            url: imgUrl,
            message: "Image failed to load",
            possibleCause: "Server not running, resource not found, or CORS restriction"
          }
        });
        setIsCheckingConnection(false);
      };
      
      // Iniciar la carga de la imagen
      img.src = imgUrl;
      
    } catch (err) {
      console.error("Error in image ping test:", err);
      toast.error("Failed to perform image ping test");
      setIsCheckingConnection(false);
    }
  };

  const hasEnoughCredits = creditsAvailable >= creditsRequired;

  // Format time display (remaining or elapsed)
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Update the copyToClipboard function
  const copyToClipboard = (text: string | object | null) => {
    if (text === null) return;
    const textToCopy = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
    navigator.clipboard.writeText(textToCopy);
    toast.success("Copied to clipboard");
  };

  // Función para iniciar la cuenta regresiva
  const startCountdown = () => {
    setTimeRemaining(estimatedTime)
    setShowEstimatedTime(true)
    
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    // Limpiar el intervalo cuando el componente se desmonte
    return () => clearInterval(interval)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2 mb-2">
            {icon || <BarChart className="h-5 w-5 text-primary" />}
            <DialogTitle>{title || "AI Action"}</DialogTitle>
          </div>
          <DialogDescription>
            {description || "This action will use AI to process your data."}
          </DialogDescription>
        </DialogHeader>
        
        {/* Contenedor con scroll para el contenido principal */}
        <div className="flex-1 overflow-y-auto pr-1 my-2 w-full">
          {/* Credits information */}
          {!isLoading && !error && (
            <div className="bg-muted/50 rounded-lg p-3 mb-2 w-full">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">AI Credits</span>
                </div>
                <Badge variant={hasEnoughCredits ? "outline" : "destructive"} className="font-mono">
                  {creditsAvailable} / {creditsRequired}
                </Badge>
              </div>
              
              <div className="text-xs text-muted-foreground">
                This action will use {creditsRequired} AI credit{creditsRequired !== 1 ? 's' : ''}.
                {!hasEnoughCredits && (
                  <div className="flex items-center gap-1 mt-1 text-destructive">
                    <XCircle className="h-3 w-3" />
                    <span>Not enough credits available</span>
                  </div>
                )}
              </div>
              
              {/* Leyenda de resultados movida del footer al cuerpo */}
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                <HelpCircle className="h-3 w-3" />
                <span>Results may vary based on your data</span>
              </div>
            </div>
          )}
          
          {/* Direct Connection Test - Solo mostrar cuando hay un error de conexión */}
          {/* Eliminamos esta sección ya que ahora solo queremos mostrar el botón cuando hay un error de servidor */}
          
          {/* Loading state with enhanced animation */}
          {isLoading && (
            <div className="my-4 space-y-4">
              <div className="flex flex-col items-center">
                <div className={`relative flex items-center justify-center w-16 h-16 mb-3 ${pulseAnimation ? 'scale-110' : 'scale-100'} transition-transform duration-700`}>
                  {!isCompleted ? (
                    <>
                      {/* Concentric circles with different animation speeds */}
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping-slow" 
                          style={{ animationDelay: "0ms" }}></div>
                      <div className="absolute inset-2 rounded-full bg-primary/20 animate-ping-slow" 
                          style={{ animationDelay: "300ms" }}></div>
                      <div className="absolute inset-4 rounded-full bg-primary/30 animate-ping-slow" 
                          style={{ animationDelay: "600ms" }}></div>
                      <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                        <Loader className="h-5 w-5 animate-spin" />
                      </div>
                    </>
                  ) : (
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                  )}
                </div>
                
                <div className="text-center space-y-1">
                  {isCompleted ? (
                    <p className="font-medium text-green-600">Process completed successfully!</p>
                  ) : (
                    <p className="font-medium">{processingMessages[currentMessageIndex]}</p>
                  )}
                  
                  <p className="text-sm text-muted-foreground">
                    {isCompleted 
                      ? `Completed in ${formatTime(timeElapsed)}`
                      : isOvertime 
                        ? `Elapsed time: ${formatTime(timeElapsed)}` 
                        : `Estimated time: ${formatTime(estimatedTime - timeElapsed)}`
                    }
                  </p>
                  
                  {/* Overtime message */}
                  {isOvertime && !isCompleted && (
                    <div className="flex items-center justify-center gap-1 text-amber-500 text-xs mt-1">
                      <HelpCircle className="h-3 w-3" />
                      <span>This is taking longer than expected. Please wait...</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Main progress bar */}
              <div className="space-y-2">
                <Progress value={progress} className={`h-2 ${isCompleted ? 'bg-green-100' : ''}`} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Starting</span>
                  <span>Processing</span>
                  <span>Completing</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className="space-y-4 mt-2">
              <div className={`rounded-lg p-4 ${serverError ? 'bg-destructive/10 border border-destructive/20' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {serverError ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div className="space-y-1 w-full overflow-hidden">
                    <h3 className={`text-sm font-medium ${serverError ? 'text-destructive' : 'text-amber-800'}`}>
                      {serverError ? (
                        error?.includes("Cannot connect to API server") || 
                        error?.includes("Network error") || 
                        error?.includes("Connection refused") 
                          ? 'Connection Error' 
                          : 'Server Error'
                      ) : 'Process Failed'}
                    </h3>
                    <p className={`text-sm break-words ${serverError ? 'text-destructive/90' : 'text-amber-700'}`}>
                      {error}
                    </p>
                    {serverError && (
                      <p className="text-xs text-destructive/80 mt-1">
                        {error?.includes("Cannot connect to API server") || 
                         error?.includes("Network error") || 
                         error?.includes("Connection refused") 
                          ? "The API server is not running or is not accessible. Please make sure the API server is running at the configured URL before trying again."
                          : "The server returned an unexpected response. This might be due to maintenance or temporary issues."}
                      </p>
                    )}
                    
                    {/* Botón de prueba de conexión dentro de la sección de error */}
                    {serverError && (
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDirectConnectionTest}
                          disabled={isTestingConnection || isProcessing}
                          className="flex items-center gap-2 w-full"
                        >
                          {isTestingConnection ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                              Testing Connection...
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4" />
                              Test Connection
                            </>
                          )}
                        </Button>
                        
                        {/* Mostrar resultado de la prueba de conexión */}
                        {connectionStatus && (
                          <div className="flex items-center gap-2 mt-2">
                            {connectionStatus === "success" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className={connectionStatus === "success" ? "text-green-500" : "text-red-500"}>
                              {connectionStatus === "success" ? "Connected" : "Connection Failed"}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowConnectionDetails(!showConnectionDetails)}
                              className="h-6 px-2"
                            >
                              {showConnectionDetails ? "Hide Details" : "Show Details"}
                            </Button>
                          </div>
                        )}
                        
                        {/* Connection Details */}
                        {showConnectionDetails && connectionDetails && (
                          <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                            <div className="mb-1"><strong>Status:</strong> {connectionDetails.status}</div>
                            <div className="mb-1"><strong>URL:</strong> {connectionDetails.url}</div>
                            {connectionDetails.message && (
                              <div className="mb-1"><strong>Message:</strong> {connectionDetails.message}</div>
                            )}
                            {connectionDetails.error && (
                              <div className="mb-1"><strong>Error:</strong> {connectionDetails.error}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Display API response if available */}
              {apiResponse && (
                <div className={`rounded-lg p-3 text-sm ${serverError ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted'} w-full`}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-medium">
                      {serverError ? 'Server Error Response:' : 'API Response:'}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0" 
                      onClick={() => copyToClipboard(apiResponse)}
                      title="Copy to clipboard"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className={`max-h-28 overflow-y-auto overflow-x-hidden text-xs font-mono ${serverError ? 'bg-destructive/5 p-2 rounded border border-destructive/20' : 'bg-background/50 p-2 rounded border'}`}>
                    <JsonDisplay data={apiResponse} maxHeight="200px" />
                  </div>
                </div>
              )}
              
              {/* Error feedback form */}
              <div className="space-y-3 border-t pt-3">
                <div>
                  <label htmlFor="error-feedback" className="text-sm font-medium">
                    Help us improve by describing what happened:
                  </label>
                  <Textarea
                    id="error-feedback"
                    placeholder="What were you trying to do when this error occurred?"
                    className="resize-none h-16 mt-1"
                    value={userFeedback}
                    onChange={(e) => setUserFeedback(e.target.value)}
                    disabled={reportSent}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Estimated Time - solo mostrar cuando no está cargando y no hay error */}
          {showEstimatedTime && !isLoading && !error && (
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Estimated time: {Math.ceil(timeRemaining / 60)} min {timeRemaining % 60 > 0 ? timeRemaining % 60 + " sec" : ""}
                </div>
              </div>
              <Progress value={0} className="h-1" />
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-2 gap-2 sm:gap-0 border-t pt-4">
          {/* Botones de acción unificados para todos los estados */}
          <div className="flex flex-wrap gap-2 justify-end">
            {/* Botón de cancelar/cerrar */}
            {isLoading ? (
              <Button
                variant="outline"
                onClick={() => {
                  setIsLoading(false);
                  setIsOpen(false);
                }}
              >
                Close
              </Button>
            ) : error ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                  }}
                >
                  Close
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAction}
                  disabled={isSendingReport}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Try Again
                </Button>
                <Button
                  variant={reportSent ? "ghost" : "secondary"}
                  size="sm"
                  onClick={handleSendErrorReport}
                  disabled={isSendingReport || reportSent || !userFeedback.trim()}
                >
                  {isSendingReport ? (
                    <>
                      <Loader className="mr-1 h-3 w-3 animate-spin" />
                      Sending...
                    </>
                  ) : reportSent ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Report Sent
                    </>
                  ) : (
                    <>
                      <Mail className="mr-1 h-3 w-3" />
                      Send Report
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={isLoading || isProcessing || !hasEnoughCredits}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <BarChart className="h-4 w-4" />
                      {actionLabel || "Start"}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Export an AI icon component for use in buttons that trigger AI features
export function AIActionIcon({ className = "", size = 20 }: { className?: string, size?: number }) {
  return (
    <BarChart className={className} size={size} />
  )
} 