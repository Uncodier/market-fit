"use client";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/app/components/ui/skeleton";
export function BookingLoading({ isEmbed }: {
    isEmbed: boolean;
}) {
    return (<div className={cn("bg-background flex flex-col", !isEmbed && "min-h-screen")}>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6 flex flex-col justify-center items-center md:items-start text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-6 w-full">
                <Skeleton className="h-10 w-10 rounded"/>
                <Skeleton className="h-8 w-32"/>
              </div>
                <div className="space-y-4 flex flex-col items-center md:items-start w-full">
                  <Skeleton className="h-16 w-16 rounded-full"/>
                  <div className="w-full flex flex-col items-center md:items-start">
                    <Skeleton className="h-3 w-24 mb-2"/>
                    <Skeleton className="h-8 w-48"/>
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2 w-full">
                    <Skeleton className="h-4 w-4 rounded-full"/>
                    <Skeleton className="h-4 w-16"/>
                  </div>
                  <div className="space-y-2 w-full flex flex-col items-center md:items-start">
                    <Skeleton className="h-4 w-full"/>
                    <Skeleton className="h-4 w-5/6"/>
                    <Skeleton className="h-4 w-4/6"/>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 relative w-full overflow-visible z-0">
                <Card className="card-calendar bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col w-full md:w-[590px] md:max-w-full">
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex-1 flex flex-col w-full">
                      <div className="flex items-center justify-between mb-6 px-1">
                        <Skeleton className="h-8 w-8 rounded-md"/>
                        <Skeleton className="h-7 w-32 mx-auto"/>
                        <Skeleton className="h-8 w-8 rounded-md"/>
                      </div>

                      <div className="grid grid-cols-7 gap-1 mb-4">
                        {Array.from({ length: 7 }).map((_, i) => (<Skeleton key={i} className="h-4 w-4 mx-auto my-2"/>))}
                      </div>

                      <div className="grid grid-cols-7 gap-y-5 md:gap-y-6 gap-x-1 mt-4">
                        {Array.from({ length: 42 }).map((_, i) => (<Skeleton key={i} className="h-11 w-11 sm:h-12 sm:w-12 mx-auto rounded-full"/>))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>);
}
