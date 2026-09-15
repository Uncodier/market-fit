export function ChatMessagesLoading() {
  return (
    <div className="space-y-6 w-full">
      {[1, 2, 3].map((index) => (
        <div
          key={index}
          className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          {index % 2 === 0 ? (
            <div className="flex flex-col max-w-[85%] md:max-w-[75%] min-w-0 px-4 md:px-0 w-full md:w-[60%]">
              <div className="flex items-center mb-1 gap-2">
                <div className="relative">
                  <div className="h-7 w-7 rounded-full bg-primary/10 animate-pulse" />
                </div>
                <div className="h-4 w-24 bg-primary/10 rounded animate-pulse" />
              </div>
              <div className="ml-9 rounded-lg p-4 bg-muted/50 dark:bg-muted/20 animate-pulse">
                <div className="h-4 bg-muted-foreground/20 rounded w-[90%]" />
                <div className="h-4 bg-muted-foreground/20 rounded w-[75%] mt-3" />
                <div className="h-4 bg-muted-foreground/20 rounded w-[85%] mt-3" />
                <div className="flex justify-between items-center mt-3">
                  <div className="h-3 bg-muted-foreground/15 rounded w-1/3" />
                  <div className="h-3 bg-muted-foreground/15 rounded w-12 text-right" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col max-w-[85%] md:max-w-[75%] min-w-0 items-end px-4 md:px-0 w-full md:w-[60%]">
              <div className="flex flex-col min-w-0 items-end group w-full">
                <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                  <div className="h-7 w-7 rounded-full bg-amber-500/10 animate-pulse" />
                  <div className="h-4 w-20 bg-amber-500/10 rounded animate-pulse" />
                </div>
                <div className="rounded-lg p-4 mr-9 w-full bg-muted/30 dark:bg-muted/10 animate-pulse">
                  <div className="h-4 bg-muted-foreground/10 rounded w-[95%]" />
                  <div className="h-4 bg-muted-foreground/10 rounded w-[80%] mt-3" />
                  <div className="flex justify-between items-center mt-3">
                    <div className="h-3 bg-muted-foreground/10 rounded w-12" />
                    <div className="h-3 bg-muted-foreground/10 rounded w-12 text-right" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
