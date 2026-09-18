import { resolveCheckoutUrls } from "@/app/api/stripe/checkout/checkout-url-security"

describe("checkout return URL security", () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalOrigins = process.env.CHECKOUT_RETURN_ORIGINS

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", {
      configurable: true,
      value: originalNodeEnv,
      writable: true,
    })
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    if (originalOrigins === undefined) delete process.env.CHECKOUT_RETURN_ORIGINS
    else process.env.CHECKOUT_RETURN_ORIGINS = originalOrigins
  })

  function resolve(origin: string) {
    return resolveCheckoutUrls(
      {
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "origin" ? origin : null,
        },
      } as Request,
      `${origin}/return`,
      undefined,
      { success: "true" },
    )
  }

  it("rejects an unconfigured localhost origin in production", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      configurable: true,
      value: "production",
      writable: true,
    })
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com"
    delete process.env.CHECKOUT_RETURN_ORIGINS

    expect(resolve("http://localhost:3000")).toEqual({
      error: "A trusted checkout origin is required",
    })
  })

  it("allows localhost outside production", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      configurable: true,
      value: "test",
      writable: true,
    })
    delete process.env.CHECKOUT_RETURN_ORIGINS

    expect(resolve("http://localhost:3000")).toMatchObject({
      successUrl: "http://localhost:3000/return?success=true",
      cancelUrl: "http://localhost:3000/return?canceled=true",
    })
  })

  it("allows an explicitly configured localhost origin in production", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      configurable: true,
      value: "production",
      writable: true,
    })
    process.env.CHECKOUT_RETURN_ORIGINS = "http://localhost:4173"

    expect(resolve("http://localhost:4173")).toMatchObject({
      successUrl: "http://localhost:4173/return?success=true",
      cancelUrl: "http://localhost:4173/return?canceled=true",
    })
  })
})
