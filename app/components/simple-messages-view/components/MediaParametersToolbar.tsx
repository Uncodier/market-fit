import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Button } from "@/app/components/ui/button"
import { ImageParameters, VideoParameters, AudioParameters } from '../types'

interface MediaParametersToolbarProps {
  selectedActivity: string
  imageParameters: ImageParameters
  videoParameters: VideoParameters
  audioParameters: AudioParameters
  onImageParameterChange: (key: keyof ImageParameters, value: any) => void
  onVideoParameterChange: (key: keyof VideoParameters, value: any) => void
  onAudioParameterChange: (key: keyof AudioParameters, value: any) => void
}

export const MediaParametersToolbar: React.FC<MediaParametersToolbarProps> = ({
  selectedActivity,
  imageParameters,
  videoParameters,
  audioParameters,
  onImageParameterChange,
  onVideoParameterChange,
  onAudioParameterChange
}) => {
  // Only show toolbar for media generation activities
  if (!['generate-image', 'generate-video', 'generate-audio'].includes(selectedActivity)) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {selectedActivity === 'generate-image' && (
        <>
          {/* Format Selector */}
          <Select 
            value={imageParameters.format} 
            onValueChange={(value) => onImageParameterChange('format', value)}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PNG" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">PNG</SelectItem>
              <SelectItem value="JPG" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">JPG</SelectItem>
              <SelectItem value="WebP" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">WebP</SelectItem>
            </SelectContent>
          </Select>

          {/* Aspect Ratio Selector */}
          <Select 
            value={imageParameters.aspectRatio} 
            onValueChange={(value) => onImageParameterChange('aspectRatio', value)}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1:1" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">1:1</SelectItem>
              <SelectItem value="4:3" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">4:3</SelectItem>
              <SelectItem value="3:4" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">3:4</SelectItem>
              <SelectItem value="16:9" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">16:9</SelectItem>
              <SelectItem value="9:16" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">9:16</SelectItem>
              <SelectItem value="3:2" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">3:2</SelectItem>
              <SelectItem value="2:3" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">2:3</SelectItem>
            </SelectContent>
          </Select>

          {/* Quality Selector */}
          <Select 
            value={imageParameters.quality.toString()} 
            onValueChange={(value) => onImageParameterChange('quality', parseInt(value))}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Low</SelectItem>
              <SelectItem value="50" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Fair</SelectItem>
              <SelectItem value="75" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Good</SelectItem>
              <SelectItem value="85" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">High</SelectItem>
              <SelectItem value="95" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Very High</SelectItem>
              <SelectItem value="100" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Maximum</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}

      {selectedActivity === 'generate-video' && (
        <>
          {/* Aspect Ratio Selector */}
          <Select 
            value={videoParameters.aspectRatio} 
            onValueChange={(value) => onVideoParameterChange('aspectRatio', value)}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">16:9</SelectItem>
              <SelectItem value="9:16" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">9:16</SelectItem>
              <SelectItem value="1:1" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">1:1</SelectItem>
              <SelectItem value="3:4" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">3:4</SelectItem>
              <SelectItem value="4:3" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">4:3</SelectItem>
            </SelectContent>
          </Select>

          {/* Resolution Selector */}
          <Select 
            value={videoParameters.resolution} 
            onValueChange={(value) => onVideoParameterChange('resolution', value)}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="720p" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">720p</SelectItem>
              <SelectItem value="1080p" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">1080p</SelectItem>
            </SelectContent>
          </Select>

          {/* Duration Selector */}
          <Select 
            value={videoParameters.duration.toString()} 
            onValueChange={(value) => onVideoParameterChange('duration', parseInt(value))}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">10s</SelectItem>
              <SelectItem value="15" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">15s</SelectItem>
              <SelectItem value="30" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">30s</SelectItem>
              <SelectItem value="45" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">45s</SelectItem>
              <SelectItem value="60" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">60s</SelectItem>
              <SelectItem value="90" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">90s</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}

      {selectedActivity === 'generate-audio' && (
        <>
          {/* Format Selector */}
          <Select 
            value={audioParameters.format} 
            onValueChange={(value) => onAudioParameterChange('format', value)}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MP3" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">MP3</SelectItem>
              <SelectItem value="WAV" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">WAV</SelectItem>
              <SelectItem value="AAC" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">AAC</SelectItem>
            </SelectContent>
          </Select>

          {/* Sample Rate Selector */}
          <Select 
            value={audioParameters.sampleRate} 
            onValueChange={(value) => onAudioParameterChange('sampleRate', value)}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="44.1kHz" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">44.1kHz</SelectItem>
              <SelectItem value="48kHz" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">48kHz</SelectItem>
            </SelectContent>
          </Select>

          {/* Channels Selector */}
          <Select 
            value={audioParameters.channels} 
            onValueChange={(value) => onAudioParameterChange('channels', value)}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary hover:bg-secondary/80 border-secondary w-auto min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mono" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">Mono</SelectItem>
              <SelectItem value="stereo" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">Stereo</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  )
}
