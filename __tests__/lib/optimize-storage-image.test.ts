import {
  IMAGE_SIZE_PX,
  optimizeForPreset,
  optimizeStorageImageUrl,
} from "@/app/lib/optimize-storage-image"
import {
  resolveItemImage,
  resolvePromotionImage,
} from "@/app/lib/image-utils"

const STORAGE_OBJECT =
  "https://abcd.supabase.co/storage/v1/object/public/catalog/item.jpg"
const STORAGE_RENDER =
  "https://abcd.supabase.co/storage/v1/render/image/public/catalog/item.jpg?width=400&resize=cover&quality=75"

describe("optimizeStorageImageUrl", () => {
  const prev = process.env.NEXT_PUBLIC_SUPABASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co"
  })

  afterAll(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prev
  })

  it("rewrites public object URL to render endpoint with width", () => {
    const out = optimizeStorageImageUrl(STORAGE_OBJECT, {
      width: 128,
      quality: 70,
      resize: "cover",
    })
    expect(out).toContain("/storage/v1/render/image/public/catalog/item.jpg")
    expect(out).toContain("width=128")
    expect(out).toContain("quality=70")
    expect(out).toContain("resize=cover")
  })

  it("updates params on an already-transformed URL", () => {
    const out = optimizeStorageImageUrl(STORAGE_RENDER, {
      width: 800,
      quality: 80,
    })
    expect(out).toContain("/storage/v1/render/image/public/")
    expect(out).toContain("width=800")
    expect(out).toContain("quality=80")
    expect(out).not.toContain("width=400")
  })

  it("fail-opens for non-Supabase hosts", () => {
    const url = "https://cdn.example/photo.jpg"
    expect(optimizeStorageImageUrl(url, { width: 128 })).toBe(url)
  })

  it("fail-opens for invalid URLs", () => {
    expect(optimizeStorageImageUrl("not a url", { width: 128 })).toBe("not a url")
  })

  it("still rewrites *.supabase.co when the configured URL is another project", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://other.supabase.co"
    const out = optimizeStorageImageUrl(STORAGE_OBJECT, { width: 128 })
    expect(out).toContain("/render/image/public/")
    expect(out).toContain("width=128")
  })

  it("rewrites *.supabase.co when NEXT_PUBLIC_SUPABASE_URL is a custom domain", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.makinari.com"
    const out = optimizeStorageImageUrl(STORAGE_OBJECT, { width: 128 })
    expect(out).toContain("https://abcd.supabase.co/storage/v1/render/image/public/")
    expect(out).toContain("width=128")
  })

  it("allows *.supabase.co when NEXT_PUBLIC_SUPABASE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const out = optimizeStorageImageUrl(STORAGE_OBJECT, { width: 128 })
    expect(out).toContain("width=128")
    expect(out).toContain("/render/image/public/")
  })
})

describe("optimizeForPreset", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co"
  })

  it("uses thumb width 128 with cover crop", () => {
    const out = optimizeForPreset(STORAGE_OBJECT, "thumb")
    expect(out).toContain(`width=${IMAGE_SIZE_PX.thumb}`)
    expect(out).toContain("quality=70")
    expect(out).toContain("resize=cover")
  })

  it("uses contain for full so wide heroes are not square-cropped", () => {
    const out = optimizeForPreset(STORAGE_OBJECT, "full")
    expect(out).toContain(`width=${IMAGE_SIZE_PX.full}`)
    expect(out).toContain("resize=contain")
  })

  it("uses contain for hero listing banners", () => {
    const out = optimizeForPreset(STORAGE_OBJECT, "hero")
    expect(out).toContain("resize=contain")
  })
})

describe("resolveItemImage size presets", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co"
    process.env.NEXT_PUBLIC_API_SERVER_URL = "http://localhost:3001"
  })

  it("does not rewrite uploaded URLs when size is omitted", () => {
    expect(
      resolveItemImage({ name: "Latte", image_url: STORAGE_OBJECT }),
    ).toBe(STORAGE_OBJECT)
  })

  it("rewrites uploaded Storage URLs when size is provided", () => {
    const out = resolveItemImage(
      { name: "Latte", image_url: STORAGE_OBJECT },
      "thumb",
    )
    expect(out).toContain("/render/image/public/")
    expect(out).toContain("width=128")
  })

  it("aligns AI prompt size to the preset", () => {
    const out = resolveItemImage({ name: "Latte", image_url: null }, "card")
    expect(out).toContain("/api/public/image/prompt/")
    expect(out).toContain("width=400")
    expect(out).toContain("height=400")
  })

  it("keeps AI default at 1024 when size omitted", () => {
    const out = resolveItemImage({ name: "Latte", image_url: null })
    expect(out).toContain("width=1024")
  })

  it("leaves non-storage uploads unchanged even with a size", () => {
    const url = "https://cdn.example/mocha.jpg"
    expect(resolveItemImage({ name: "Mocha", image_url: url }, "hero")).toBe(
      url,
    )
  })
})

describe("resolvePromotionImage size presets", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co"
    process.env.NEXT_PUBLIC_API_SERVER_URL = "http://localhost:3001"
  })

  it("optimizes uploaded promo images", () => {
    const out = resolvePromotionImage(
      { name: "BOGO", image_url: STORAGE_OBJECT },
      "hero",
    )
    expect(out).toContain("width=800")
  })

  it("aligns AI promo size to the preset", () => {
    const out = resolvePromotionImage({ name: "BOGO", image_url: null }, "thumb")
    expect(out).toContain("width=128")
  })
})
