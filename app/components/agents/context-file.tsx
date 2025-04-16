import { Button } from "@/app/components/ui/button"
import { FileText, Trash2, Download, ExternalLink } from "@/app/components/ui/icons"
import { UploadFileDialog } from "@/app/components/agents/upload-file-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

interface ContextFileProps {
  id: string
  name: string
  path: string
  agentId: string
  onRemove: (id: string) => void
  onUpdate: (fileData: { id: string; name: string; path: string }) => void
}

export function ContextFile({ id, name, path, agentId, onRemove, onUpdate }: ContextFileProps) {
  // Function to open the file in a new tab
  const handleOpenFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(path, '_blank');
  };
  
  // Function to download the file
  const handleDownloadFile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Fetch the file
      const response = await fetch(path);
      const blob = await response.blob();
      
      // Create a download link
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  // Format the path to show just the filename for display purposes
  const displayPath = path.split('/').pop() || path;

  return (
    <div className="group relative flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <UploadFileDialog 
        agentId={agentId}
        mode="update"
        initialData={{ id, name, path }}
        onFileUploaded={onUpdate}
        trigger={
          <div className="flex items-center space-x-3 w-full pr-28 cursor-pointer">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="font-medium truncate pr-2">{name}</div>
              <div className="text-xs text-muted-foreground truncate pr-2" title={path}>
                {displayPath}
              </div>
            </div>
          </div>
        }
      />
      <div className="absolute right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleOpenFile}
                aria-label={`Open ${name}`}
              >
                <ExternalLink className="h-4 w-4 text-blue-500 hover:text-blue-700" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleDownloadFile}
                aria-label={`Download ${name}`}
              >
                <Download className="h-4 w-4 text-green-500 hover:text-green-700" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(id);
                }}
                aria-label={`Remove ${name}`}
              >
                <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
} 