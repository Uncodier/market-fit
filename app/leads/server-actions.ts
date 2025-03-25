'use server'

import { revalidatePath } from "next/cache"

export async function revalidateLeadsPath() {
  revalidatePath('/leads')
} 