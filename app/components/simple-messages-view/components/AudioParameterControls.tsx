"use client"

import { useId } from "react"
import { Speaker } from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/app/components/ui/select"
import {
  normalizeSpeechLanguage,
  normalizeSpeechVoice,
  SPEECH_LANGUAGE_LABELS,
  SPEECH_LANGUAGE_VALUES,
  SPEECH_VOICE_LABELS,
  SPEECH_VOICE_VALUES,
} from "@/lib/ai/speech-options"
import type { AudioParameters } from "../types"

interface AudioParameterControlsProps {
  parameters: AudioParameters
  onParameterChange: (key: keyof AudioParameters, value: AudioParameters[keyof AudioParameters]) => void
}

function AudioSelect<Value extends string>({
  label,
  value,
  values,
  labels,
  onChange,
  descriptionId,
}: {
  label: string
  value: Value
  values: readonly Value[]
  labels: Record<Value, string>
  onChange: (value: Value) => void
  descriptionId?: string
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Value)}>
      <SelectTrigger
        hideIcon
        aria-label={`Audio ${label.toLowerCase()}`}
        aria-describedby={descriptionId}
        className="h-8 bg-secondary hover:bg-secondary/80 border-secondary text-xs w-auto min-w-fit"
      >
        <span className="flex items-center gap-2">
          {label === "Format" && <Speaker className="h-4 w-4 shrink-0" aria-hidden={true} />}
          <span>{label}: {labels[value]}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {values.map((option) => (
          <SelectItem
            key={option}
            value={option}
            hideIndicator
            className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700"
          >
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AudioParameterControls({ parameters, onParameterChange }: AudioParameterControlsProps) {
  const descriptionId = useId()

  return (
    <>
      <AudioSelect
        label="Format"
        value={parameters?.format ?? "MP3"}
        values={["MP3", "WAV"]}
        labels={{ MP3: "MP3", WAV: "WAV" }}
        onChange={(value) => onParameterChange("format", value)}
      />
      <AudioSelect
        label="Voice"
        value={normalizeSpeechVoice(parameters?.voice)}
        values={SPEECH_VOICE_VALUES}
        labels={SPEECH_VOICE_LABELS}
        onChange={(value) => onParameterChange("voice", value)}
      />
      <AudioSelect
        label="Language"
        value={normalizeSpeechLanguage(parameters?.language)}
        values={SPEECH_LANGUAGE_VALUES}
        labels={SPEECH_LANGUAGE_LABELS}
        onChange={(value) => onParameterChange("language", value)}
        descriptionId={descriptionId}
      />
      <p id={descriptionId} className="basis-full text-xs text-muted-foreground">
        Language guides the agent when writing speech text. Azure tts-hd is multilingual
        and detects the language from the input text; it does not translate it.
      </p>
    </>
  )
}