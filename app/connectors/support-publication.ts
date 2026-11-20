import { z } from "zod"

export const publicationLabel = /^Label_[0-9]{1,32}$/
export const supportPublication = z.object({ audience: z.enum(["verified", "anonymous"]), label_id: z.string().regex(publicationLabel) }).strict()
export type SupportPublication = z.infer<typeof supportPublication>