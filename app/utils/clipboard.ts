export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  
  // Try modern clipboard API first
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API failed (likely blocked by permissions policy), falling back to execCommand", err);
    }
  }

  // Fallback to execCommand for older browsers or if permissions policy blocks the modern API
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Make the textarea invisible
    textArea.style.position = "fixed";
    textArea.style.top = "-999999px";
    textArea.style.left = "-999999px";
    textArea.style.width = "2rem";
    textArea.style.height = "2rem";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (err) {
    console.error("Fallback clipboard execution failed", err);
    return false;
  }
}
