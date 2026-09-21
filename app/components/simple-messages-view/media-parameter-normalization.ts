import type { VideoParameters } from "./types"

export function applyVideoParameterChange(
  current: VideoParameters,
  key: keyof VideoParameters,
  value: VideoParameters[keyof VideoParameters],
): VideoParameters {
  const changed = { ...current, [key]: value } as VideoParameters
  if (key === "resolution" && value === "1080p") {
    return {
      ...changed,
      aspectRatio: "16:9",
      duration: 8,
    }
  }
  if (
    current.resolution === "1080p"
    && (
      (key === "aspectRatio" && value !== "16:9")
      || (key === "duration" && value !== 8)
    )
  ) {
    return { ...changed, resolution: "720p" }
  }
  return changed
}

export function normalizeVideoParametersForExecution(
  parameters: VideoParameters,
): VideoParameters {
  return parameters.resolution === "1080p"
    ? { ...parameters, aspectRatio: "16:9", duration: 8 }
    : parameters
}
