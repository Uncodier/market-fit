/** Match the public URL contract independently of the generated manifest. */
export function catalogIconUrl(key: string) {
  return expect.stringMatching(new RegExp(`^/images/modules/catalog/${key}\\.[0-9a-f]{12}\\.webp$`))
}