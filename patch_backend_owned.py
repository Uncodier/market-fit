import os
owned_file = '../API/src/app/api/integrations/zavu/phone-numbers/route.ts'
owned_content = """import { NextRequest, NextResponse } from "next/server";
import { getOwnedNumbers } from "@/lib/services/zavu";

export async function GET(request: NextRequest) {
  try {
    const data = await getOwnedNumbers();
    return NextResponse.json(data.items || data.results || data);
  } catch (error: any) {
    console.error("[Zavu PhoneNumbers] Error fetching owned numbers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch owned phone numbers" },
      { status: error.status || 500 }
    );
  }
}
"""
os.makedirs(os.path.dirname(owned_file), exist_ok=True)
with open(owned_file, 'w') as f:
    f.write(owned_content)
print("Created phone-numbers/route.ts successfully")

client_file = '../API/src/lib/services/zavu/client.ts'
with open(client_file, 'r') as f:
    content = f.read()

injection = """
export async function getOwnedNumbers(): Promise<any> {
  return zavuFetch("/phone-numbers");
}
"""
if 'export async function getOwnedNumbers' not in content:
    target = 'export async function purchaseNumber'
    content = content.replace(target, injection + "\n" + target)
    with open(client_file, 'w') as f:
        f.write(content)
    print("Patched client.ts successfully")
