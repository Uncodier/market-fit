"use server"

import { loadSelfServiceModifierOptions, type SelfServiceModifierRequest } from "./self-service-modifier-options"

export async function getSelfServiceModifierOptions(input: SelfServiceModifierRequest) {
  return loadSelfServiceModifierOptions(input)
}