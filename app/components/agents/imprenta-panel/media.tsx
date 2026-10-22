import { ImprentaLazyPreviewVideo, ImprentaLazyCardImage } from "@/app/components/agents/imprenta-lazy-media"
import { cn } from "@/lib/utils"
import { Play, ZoomIn } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"

import type { useImprentaPanelState } from './state'

type ImprentaMediaOptions = Pick<ReturnType<typeof useImprentaPanelState>, "setZoomedMedia">

export function useImprentaMedia({ setZoomedMedia }: ImprentaMediaOptions) {
  const renderMediaWithZoom = (
    url: string,
    type: 'image' | 'video',
    key: React.Key,
    aspectRatio = "1/1",
    bleed = false
  ) => (
    <div key={key} className="relative group w-full">
      {type === 'image' ? (
        <ImprentaLazyCardImage
          url={url}
          alt="Generated media"
          aspectRatio={aspectRatio}
          bleed={bleed}
          onOpen={() => setZoomedMedia({ url, type: "image" })}
        />
      ) : (
        <div
          className={cn(
            "relative w-full overflow-hidden bg-black/10 flex items-center justify-center cursor-pointer group/video",
            bleed ? "rounded-none" : "rounded-xl"
          )}
          style={{ aspectRatio }}
          onClick={(e) => { e.stopPropagation(); setZoomedMedia({ url, type }); }}
        >
          <ImprentaLazyPreviewVideo url={url} priority={true} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/10 group-hover/video:bg-black/30 transition-colors z-[2] flex items-center justify-center pointer-events-none">
            <div className="bg-background/80 backdrop-blur text-foreground w-12 h-12 flex items-center justify-center rounded-full shadow-lg transform group-hover/video:scale-110 transition-transform">
              <Play className="h-6 w-6 translate-x-[2px]" />
            </div>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white border-0"
            onClick={(e) => { e.stopPropagation(); setZoomedMedia({ url, type }); }}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      )}
      {type === 'image' && (
        <div
          className={cn(
            "absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100",
            bleed ? "rounded-none" : "rounded-xl"
          )}
        >
          <div className="bg-black/50 text-white p-2 rounded-full backdrop-blur-sm shadow-sm">
            <ZoomIn className="h-5 w-5" />
          </div>
        </div>
      )}
    </div>
  )

  return { renderMediaWithZoom }
}
