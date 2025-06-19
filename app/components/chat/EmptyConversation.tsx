import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";

interface EmptyConversationProps {
  agentId: string;
  agentName: string;
  title?: string;
  description?: string;
  avatarSrc?: string;
}

export function EmptyConversation({
  agentId,
  agentName,
  title = `Start your conversation with ${agentName}`,
  description = `Type your first message to start interacting with ${agentName}.`,
  avatarSrc
}: EmptyConversationProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center" style={{ transform: 'translateY(calc((100vh - 311px) / 2 - 100px))' }}>
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Avatar className="h-12 w-12 border border-primary/20">
          <AvatarImage 
            src={avatarSrc || `/avatars/agent-${agentId}.png`} 
            alt={agentName} 
          />
          <AvatarFallback className="bg-primary/10">
            {agentName.charAt(0)}
          </AvatarFallback>
        </Avatar>
      </div>
      <h3 className="text-xl font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-[500px] mb-6">
        {description}
      </p>
    </div>
  );
} 