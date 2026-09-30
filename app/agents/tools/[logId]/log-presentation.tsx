"use client"

import { Badge } from "@/app/components/ui/badge"

import { AlertCircle, CheckCircle2, FileText, Info, User, Bot, Settings, XCircle, Zap } from "@/app/components/ui/icons"

import React from "react"

// For consistent formatting of dates across the application
export function formatDate(dateString: string | undefined | null) {
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
export function formatDuration(durationMs: number | undefined | null) {
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

// Component to show log level with proper styling
export function LevelBadge({ level }: { level: string }) {
  switch (level) {
    case "debug":
      return (
        <Badge variant="outline" className="bg-muted/10 text-muted-foreground border-muted/30">
          <Info className="h-3.5 w-3.5 mr-1.5" />
          Debug
        </Badge>
      );
    case "info":
      return (
        <Badge variant="outline" className="bg-info/10 text-info border-info/30">
          <Info className="h-3.5 w-3.5 mr-1.5" />
          Info
        </Badge>
      );
    case "warn":
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
          <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
          Warning
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Error
        </Badge>
      );
    case "critical":
      return (
        <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/40">
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Critical
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {level}
        </Badge>
      );
  }
}

// Component to show log type with proper styling
export function LogTypeBadge({ logType }: { logType: string }) {
  const getIcon = () => {
    switch (logType) {
      case "system":
        return <FileText className="h-3.5 w-3.5 mr-1.5" />;
      case "user_action":
        return <User className="h-3.5 w-3.5 mr-1.5" />;
      case "agent_action":
        return <Bot className="h-3.5 w-3.5 mr-1.5" />;
      case "tool_call":
        return <Settings className="h-3.5 w-3.5 mr-1.5" />;
      case "tool_result":
        return <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 mr-1.5" />;
      case "performance":
        return <Zap className="h-3.5 w-3.5 mr-1.5" />;
      default:
        return <FileText className="h-3.5 w-3.5 mr-1.5" />;
    }
  };

  return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
      {getIcon()}
      {logType.replace('_', ' ')}
    </Badge>
  );
}

// Format token usage display
export function formatTokens(tokensUsed?: unknown) {
  if (!tokensUsed) return "N/A";
  
  if (typeof tokensUsed === 'object') {
    const count = (key: string) => key in tokensUsed && typeof Reflect.get(tokensUsed, key) === 'number'
      ? Number(Reflect.get(tokensUsed, key)) : 0;
    const promptTokens = count('promptTokens') || count('prompt_tokens');
    const completionTokens = count('completionTokens') || count('completion_tokens');
    const totalTokens = count('totalTokens') || count('total_tokens') || (promptTokens + completionTokens);
    
    if (totalTokens > 0) {
      return `${promptTokens.toLocaleString()} / ${completionTokens.toLocaleString()} (${totalTokens.toLocaleString()} total)`;
    }
  }
  
  return "N/A";
}

// Render base64 images in content
export function renderBase64Images(contentString: string) {
  const imageRegex = /(data:image\/[^;]+;base64,[^\s"]+)/g;
  const urlRegex = /(https?:\/\/[^\s"]+)/g;
  
  const extractMatches = (regex: RegExp, type: string) => {
    const matches = [];
    let match;
    
    regex.lastIndex = 0;
    
    while ((match = regex.exec(contentString)) !== null) {
      matches.push({
        type,
        value: match[0],
        index: match.index
      });
    }
    
    return matches;
  };
  
  const imageMatches = extractMatches(imageRegex, 'image');
  const urlMatches = extractMatches(urlRegex, 'url');
  
  if (imageMatches.length === 0 && urlMatches.length === 0) {
    return (
      <pre 
        className="text-sm whitespace-pre-wrap font-mono max-w-full overflow-x-auto break-all break-words"
        style={{ wordWrap: 'break-word', maxWidth: '100%' }}
      >{contentString}</pre>
    );
  }

  const allMatches = [...imageMatches, ...urlMatches].sort((a, b) => a.index - b.index);
  
  const parts = [];
  let lastIndex = 0;
  
  for (const match of allMatches) {
    const matchIndex = match.index;
    
    if (matchIndex > lastIndex) {
      parts.push({
        type: 'text',
        value: contentString.substring(lastIndex, matchIndex)
      });
    }
    
    parts.push(match);
    lastIndex = matchIndex + match.value.length;
  }
  
  if (lastIndex < contentString.length) {
    parts.push({
      type: 'text',
      value: contentString.substring(lastIndex)
    });
  }
  
  return (
    <div className="space-y-4">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part.type === 'text' && part.value.trim() && (
            <pre 
              className="text-sm whitespace-pre-wrap font-mono max-w-full overflow-x-auto break-all break-words"
              style={{ wordWrap: 'break-word', maxWidth: '100%' }}
            >{part.value}</pre>
          )}
          {part.type === 'image' && (
            <div className="my-4">
              <img 
                src={part.value} 
                alt="Screenshot" 
                className="max-w-full h-auto rounded-lg border shadow-sm"
                style={{ maxHeight: '400px' }}
              />
            </div>
          )}
          {part.type === 'url' && (
            <div className="my-2">
              <a 
                href={part.value} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline break-all"
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

