import { createClient } from "@/lib/supabase/client";

// Interfaz para el reporte de error
export interface ErrorReport {
  error: string;
  action: string;
  timestamp: string;
  timeElapsed: number;
  userFeedback?: string;
  context?: Record<string, any>;
}

/**
 * Servicio para enviar reportes de error al soporte técnico
 */
export async function sendErrorReport(report: ErrorReport): Promise<{ success: boolean; error?: string }> {
  try {
    // Obtener el cliente de Supabase para las credenciales
    const supabase = createClient();
    
    // Obtener la sesión actual para las credenciales
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: "No authenticated session found"
      };
    }
    
    // Obtener información del usuario
    const { data: { user } } = await supabase.auth.getUser();
    
    // Preparar los datos del reporte
    const reportData = {
      ...report,
      user_id: user?.id,
      user_email: user?.email,
      created_at: new Date().toISOString()
    };
    
    // En un entorno real, aquí enviarías el reporte a un endpoint de soporte
    // Por ahora, lo guardamos en la tabla de error_reports en Supabase
    const { error } = await supabase
      .from('error_reports')
      .insert(reportData);
    
    if (error) {
      console.error("Error saving error report:", error);
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error("Error sending error report:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
} 