import React, { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Image, FileVideo, Settings, LayoutGrid, BarChart, Clock, Speaker, Hash, Type, AlignLeft } from "@/app/components/ui/icons"
import { ImageParameters, VideoParameters, AudioParameters, TextParameters } from '../types'

interface MediaParametersToolbarProps {
  selectedActivity: string
  imageParameters: ImageParameters
  videoParameters: VideoParameters
  audioParameters: AudioParameters
  textParameters?: TextParameters
  onImageParameterChange: (key: keyof ImageParameters, value: any) => void
  onVideoParameterChange: (key: keyof VideoParameters, value: any) => void
  onAudioParameterChange: (key: keyof AudioParameters, value: any) => void
  onTextParameterChange?: (key: keyof TextParameters, value: any) => void
  isBrowserVisible?: boolean
}

export const MediaParametersToolbar: React.FC<MediaParametersToolbarProps> = ({
  selectedActivity,
  imageParameters,
  videoParameters,
  audioParameters,
  textParameters = { expectedResults: 1, length: 'medium', styles: [] },
  onImageParameterChange,
  onVideoParameterChange,
  onAudioParameterChange,
  onTextParameterChange,
  isBrowserVisible = false
}) => {
  const [aspectRatioOpen, setAspectRatioOpen] = useState(false)
  const [qualityOpen, setQualityOpen] = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [durationOpen, setDurationOpen] = useState(false)
  const [formatOpen, setFormatOpen] = useState(false)
  const [sampleRateOpen, setSampleRateOpen] = useState(false)
  const [channelsOpen, setChannelsOpen] = useState(false)
  const [expectedResultsOpen, setExpectedResultsOpen] = useState(false)
  const [textLengthOpen, setTextLengthOpen] = useState(false)
  const [textStyleOpen, setTextStyleOpen] = useState(false)

  // Only show toolbar for media generation activities
  if (!['prompt', 'generate-image', 'generate-video', 'generate-audio'].includes(selectedActivity)) {
    return null
  }

  const renderExpectedResultsSelector = (value: number | undefined, onChange: (val: number) => void) => (
    <div className="relative">
      <Select 
        value={(value || 1).toString()} 
        onValueChange={(val) => onChange(parseInt(val))}
        open={expectedResultsOpen}
        onOpenChange={setExpectedResultsOpen}
      >
        <SelectTrigger 
          hideIcon 
          className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
        >
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            <span>{value || 1} {value === 1 || !value ? 'result' : 'results'}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5, 10].map(num => (
            <SelectItem key={num} value={num.toString()} hideIndicator className="data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary">{num}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {selectedActivity === 'prompt' && (
        <>
          {renderExpectedResultsSelector(textParameters?.expectedResults, (val) => onTextParameterChange?.('expectedResults', val))}

          {/* Text Length Selector */}
          <div className="relative">
            <Select 
              value={textParameters?.length || 'medium'} 
              onValueChange={(value) => onTextParameterChange?.('length', value)}
              open={textLengthOpen}
              onOpenChange={setTextLengthOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <AlignLeft className="h-4 w-4" />
                  <span className="capitalize">{textParameters?.length || 'medium'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short" hideIndicator className="data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">Corto</SelectItem>
                <SelectItem value="medium" hideIndicator className="data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">Medio</SelectItem>
                <SelectItem value="long" hideIndicator className="data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">Largo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Text Styles Selector */}
          <div className="relative">
            <Select 
              value={(textParameters?.styles && textParameters.styles.length > 0) ? textParameters.styles[0] : 'default'} 
              onValueChange={(value) => onTextParameterChange?.('styles', [value])}
              open={textStyleOpen}
              onOpenChange={setTextStyleOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  <span className="capitalize">{(textParameters?.styles && textParameters.styles.length > 0) ? textParameters.styles[0] : 'Estilo Default'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default" hideIndicator className="data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">Estilo Default</SelectItem>
                <SelectItem value="formal" hideIndicator className="data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">Formal</SelectItem>
                <SelectItem value="casual" hideIndicator className="data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">Casual</SelectItem>
                <SelectItem value="persuasive" hideIndicator className="data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">Persuasivo</SelectItem>
                <SelectItem value="humorous" hideIndicator className="data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">Humorístico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {selectedActivity === 'generate-image' && (
        <>
          {renderExpectedResultsSelector(imageParameters?.expectedResults, (val) => onImageParameterChange('expectedResults', val))}
          {/* Aspect Ratio Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={imageParameters?.aspectRatio ?? '1:1'} 
              onValueChange={(value) => onImageParameterChange('aspectRatio', value)}
              open={aspectRatioOpen}
              onOpenChange={setAspectRatioOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span>{imageParameters?.aspectRatio ?? '1:1'}</span>
                </div>
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
          </div>

          {/* Quality Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={(imageParameters?.quality ?? 100).toString()} 
              onValueChange={(value) => onImageParameterChange('quality', parseInt(value))}
              open={qualityOpen}
              onOpenChange={setQualityOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  <span>{imageParameters?.quality ?? 100}%</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Baja</SelectItem>
                <SelectItem value="50" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Regular</SelectItem>
                <SelectItem value="75" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Buena</SelectItem>
                <SelectItem value="85" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Alta</SelectItem>
                <SelectItem value="95" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Muy Alta</SelectItem>
                <SelectItem value="100" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">Máxima</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {selectedActivity === 'generate-video' && (
        <>
          {renderExpectedResultsSelector(videoParameters?.expectedResults, (val) => onVideoParameterChange('expectedResults', val))}
          {/* Aspect Ratio Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={videoParameters?.aspectRatio ?? '16:9'} 
              onValueChange={(value) => onVideoParameterChange('aspectRatio', value)}
              open={aspectRatioOpen}
              onOpenChange={setAspectRatioOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span>{videoParameters?.aspectRatio ?? '16:9'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">16:9</SelectItem>
                <SelectItem value="9:16" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">9:16</SelectItem>
                <SelectItem value="1:1" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">1:1</SelectItem>
                <SelectItem value="3:4" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">3:4</SelectItem>
                <SelectItem value="4:3" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">4:3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resolution Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={videoParameters?.resolution ?? '1080p'} 
              onValueChange={(value) => onVideoParameterChange('resolution', value)}
              open={resolutionOpen}
              onOpenChange={setResolutionOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <FileVideo className="h-4 w-4" />
                  <span>{videoParameters?.resolution ?? '1080p'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">720p</SelectItem>
                <SelectItem value="1080p" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">1080p</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={(videoParameters?.duration ?? 4).toString()} 
              onValueChange={(value) => onVideoParameterChange('duration', parseInt(value))}
              open={durationOpen}
              onOpenChange={setDurationOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{videoParameters?.duration ?? 4}s</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">4s</SelectItem>
                <SelectItem value="6" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">6s</SelectItem>
                <SelectItem value="8" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">8s</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {selectedActivity === 'generate-audio' && (
        <>
          {renderExpectedResultsSelector(audioParameters?.expectedResults, (val) => onAudioParameterChange('expectedResults', val))}
          {/* Format Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={audioParameters?.format ?? 'MP3'} 
              onValueChange={(value) => onAudioParameterChange('format', value)}
              open={formatOpen}
              onOpenChange={setFormatOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <Speaker className="h-4 w-4" />
                  <span>{audioParameters?.format ?? 'MP3'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MP3" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">MP3</SelectItem>
                <SelectItem value="WAV" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">WAV</SelectItem>
                <SelectItem value="AAC" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">AAC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sample Rate Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={audioParameters?.sampleRate ?? '44.1kHz'} 
              onValueChange={(value) => onAudioParameterChange('sampleRate', value)}
              open={sampleRateOpen}
              onOpenChange={setSampleRateOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  <span>{audioParameters?.sampleRate ?? '44.1kHz'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="44.1kHz" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">44.1kHz</SelectItem>
                <SelectItem value="48kHz" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">48kHz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Channels Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={audioParameters?.channels ?? 'stereo'} 
              onValueChange={(value) => onAudioParameterChange('channels', value)}
              open={channelsOpen}
              onOpenChange={setChannelsOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>{audioParameters?.channels ?? 'stereo'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mono" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">Mono</SelectItem>
                <SelectItem value="stereo" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">Estéreo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration Selector - Icon Button */}
          <div className="relative">
            <Select 
              value={(audioParameters?.duration ?? 15).toString()} 
              onValueChange={(value) => onAudioParameterChange('duration', parseInt(value))}
              open={durationOpen}
              onOpenChange={setDurationOpen}
            >
              <SelectTrigger 
                hideIcon 
                className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{audioParameters?.duration ?? 15}s</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">5s</SelectItem>
                <SelectItem value="15" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">15s</SelectItem>
                <SelectItem value="30" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">30s</SelectItem>
                <SelectItem value="60" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">60s</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  )
}
