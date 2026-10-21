import "server-only";
import { z } from "zod";
import type { DynamicPricingConfig } from "@/app/types";

export const dynamicQuoteFieldsSchema = z.record(z.union([
  z.string().max(2000), z.number().finite(), z.boolean(), z.null(),
])).refine(value => Object.keys(value).length <= 50 && JSON.stringify(value).length <= 16000);

export function validConfiguredQuoteFields(config: DynamicPricingConfig, values: Record<string, unknown>) {
  const keys = new Set(config.fields.map(field => field.key));
  if (Object.keys(values).some(key => !keys.has(key))) return false;
  return config.fields.every(field => {
    const value = values[field.key];
    if (value === undefined || value === null || value === "") return !field.required;
    if (field.type === "boolean") return typeof value === "boolean";
    if (field.type === "number" || field.type === "distance") {
      return (typeof value === "number" || typeof value === "string") && Number.isFinite(Number(value));
    }
    if (typeof value !== "string") return false;
    if (field.type === "select") return Boolean(field.options?.includes(value));
    return true;
  });
}