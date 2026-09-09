import os

owned_file = '../API/src/app/api/integrations/zavu/phone-numbers/route.ts'
with open(owned_file, 'r') as f:
    content = f.read()

# Make sure we don't accidentally send empty data when items is not present.
# Often Zavu returns an array or an object with items.
# Let's map it safely.
new_content = """import { NextRequest, NextResponse } from "next/server";
import { getOwnedNumbers } from "@/lib/services/zavu";

export async function GET(request: NextRequest) {
  try {
    const data = await getOwnedNumbers();
    // Zavu usually returns paginated results in 'items' or 'results'
    const results = data?.items || data?.results || (Array.isArray(data) ? data : []);
    
    // Filter only those that have 'voice' capability if we want to be strict,
    // but the frontend will show them.
    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[Zavu PhoneNumbers] Error fetching owned numbers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch owned phone numbers" },
      { status: error.status || 500 }
    );
  }
}
"""

with open(owned_file, 'w') as f:
    f.write(new_content)
print("Fixed phone-numbers/route.ts")
