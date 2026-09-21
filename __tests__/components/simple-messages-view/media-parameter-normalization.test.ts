import {
  applyVideoParameterChange,
  normalizeVideoParametersForExecution,
} from "@/app/components/simple-messages-view/media-parameter-normalization"

const standardVideo = {
  aspectRatio: "9:16" as const,
  resolution: "720p" as const,
  duration: 4,
}

describe("video parameter normalization", () => {
  it("applies the constraints required by 1080p generation", () => {
    expect(applyVideoParameterChange(
      standardVideo,
      "resolution",
      "1080p",
    )).toEqual({
      aspectRatio: "16:9",
      resolution: "1080p",
      duration: 8,
    })
  })

  it("downgrades to 720p when a later edit conflicts with pro constraints", () => {
    expect(applyVideoParameterChange({
      aspectRatio: "16:9",
      resolution: "1080p",
      duration: 8,
    }, "aspectRatio", "9:16")).toMatchObject({
      aspectRatio: "9:16",
      resolution: "720p",
    })
  })

  it("normalizes legacy conflicting settings before execution", () => {
    expect(normalizeVideoParametersForExecution({
      aspectRatio: "9:16",
      resolution: "1080p",
      duration: 4,
    })).toMatchObject({
      aspectRatio: "16:9",
      duration: 8,
    })
  })
})
