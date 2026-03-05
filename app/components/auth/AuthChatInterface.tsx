import React, { useState } from 'react'
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Play, Plus } from "@/app/components/ui/icons"
import { EmptyStatePrompts } from "@/app/components/simple-messages-view/components/EmptyStatePrompts"
import { DemoMessageInput } from "./DemoMessageInput"

interface AuthChatInterfaceProps {
  onInteraction: () => void
}

export const AuthChatInterface: React.FC<AuthChatInterfaceProps> = ({ onInteraction }) => {
  const [selectedTab, setSelectedTab] = useState('new')
  
  // Fake instances for the carousel
  const instances = [
    { id: '1', name: 'Sales Agent', status: 'active' },
    { id: '2', name: 'Support Bot', status: 'running' },
    { id: '3', name: 'Marketing', status: 'running' }
  ]

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden relative">
      {/* Header with Carousel */}
      <StickyHeader className="top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 md:px-16 pt-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center w-full">
              <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar py-2">
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                  <TabsList className="bg-transparent p-0 h-auto gap-2">
                    <TabsTrigger value="new" className="data-[state=active]:bg-muted">
                      <span className="flex items-center gap-2">
                        <Plus className="h-3 w-3 text-muted-foreground" />
                        New Makina
                      </span>
                    </TabsTrigger>
                    
                    {instances.map((inst) => (
                      <TabsTrigger key={inst.id} value={inst.id} className="data-[state=active]:bg-muted">
                        <span className="flex items-center gap-2">
                          <Play className="h-3 w-3 text-green-600" />
                          {inst.name}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </StickyHeader>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/8 rounded-full font-sans blur-2xl animate-float-slow"></div>
          <div className="absolute top-1/3 left-1/3 w-56 h-56 bg-indigo-500/10 rounded-full font-sans blur-2xl animate-float-medium" style={{ animationDelay: '7s' }}></div>
          <div className="absolute bottom-1/3 right-1/3 w-60 h-60 bg-purple-500/9 rounded-full font-sans blur-2xl animate-float-reverse" style={{ animationDelay: '9s' }}></div>
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 w-48 h-48 bg-violet-500/15 rounded-full font-sans blur-xl animate-float-slow"></div>
          <div className="absolute bottom-1/3 right-1/2 transform translate-x-1/2 w-44 h-44 bg-indigo-500/12 rounded-full font-sans blur-xl animate-float-medium" style={{ animationDelay: '3s' }}></div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 w-full max-w-4xl mx-auto flex flex-col justify-end pb-32 z-10">
           {/* Welcome Message or Empty State */}
           <div className="flex flex-col items-center justify-center space-y-8 mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-center tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
                What can I help you with?
              </h1>
              
              <div className="w-full max-w-2xl">
                <EmptyStatePrompts onSelectPrompt={() => onInteraction()} />
              </div>
           </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20 bg-background/95 backdrop-blur-sm pt-4 pb-8">
          <DemoMessageInput 
            onMessageChange={() => {}} 
            onSubmit={onInteraction} 
            disabled={false} 
            placeholder="Ask anything..." 
          />
        </div>
      </div>

      <style jsx global>{`
        @keyframes float-slow {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, -20px) scale(1.1); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes float-medium {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -30px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes float-reverse {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-15px, 25px) scale(1.05); }
          100% { transform: translate(0, 0) scale(1); }
        }
        .animate-float-slow { animation: float-slow 20s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 15s ease-in-out infinite; }
        .animate-float-reverse { animation: float-reverse 18s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
