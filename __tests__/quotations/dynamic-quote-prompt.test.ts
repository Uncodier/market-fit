import {
  buildDynamicQuoteSystemPrompt,
  extractQuotePriceFromAssistantText,
} from "@/app/quotations/dynamic-quote-prompt";
import { DEFAULT_DYNAMIC_PRICING } from "@/app/catalog/dynamic-pricing";

describe("dynamic quote prompt", () => {
  it("requests expected JSON response format for price extraction", () => {
    const prompt = buildDynamicQuoteSystemPrompt({
      ...DEFAULT_DYNAMIC_PRICING,
      agent_prompt: "Price by distance",
      min_price: 50,
    });

    expect(prompt).toContain("unit_price");
    expect(prompt).toContain("currency");
    expect(prompt).toContain("rationale");
    expect(prompt).toContain("RESPONSE FORMAT");
    expect(prompt).toContain("Never return a unit_price below the minimum price of 50");
  });

  it("extracts unit_price from raw JSON", () => {
    const extracted = extractQuotePriceFromAssistantText(
      '{"unit_price": 120.5, "currency": "USD", "rationale": "Based on distance"}'
    );
    expect(extracted).toEqual({
      unit_price: 120.5,
      currency: "USD",
      rationale: "Based on distance",
    });
  });

  it("extracts unit_price from fenced JSON", () => {
    const extracted = extractQuotePriceFromAssistantText(`
Here is the quote:
\`\`\`json
{"unit_price": 99, "currency": "USD", "rationale": "Standard rate"}
\`\`\`
`);
    expect(extracted?.unit_price).toBe(99);
  });

  it("returns null when unit_price is missing", () => {
    expect(extractQuotePriceFromAssistantText('{"currency":"USD"}')).toBeNull();
  });
});
