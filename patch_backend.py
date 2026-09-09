import sys

# Update client.ts
client_file = '../API/src/lib/services/zavu/client.ts'
with open(client_file, 'r') as f:
    content = f.read()

injection = """
export async function searchAvailableNumbers(params: { countryCode: string, areaCode?: string, smsEnabled?: boolean, voiceEnabled?: boolean }): Promise<any> {
  const query = new URLSearchParams({ countryCode: params.countryCode });
  if (params.areaCode) query.append("areaCode", params.areaCode);
  if (params.smsEnabled) query.append("smsEnabled", "true");
  if (params.voiceEnabled) query.append("voiceEnabled", "true");
  return zavuFetch(`/phone-numbers/available?${query.toString()}`);
}

export async function purchaseNumber(phoneNumber: string): Promise<any> {
  return zavuFetch("/phone-numbers", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function releaseNumber(phoneNumber: string): Promise<any> {
  return zavuFetch(`/phone-numbers/${encodeURIComponent(phoneNumber)}`, {
    method: "DELETE"
  });
}

export async function assignNumberToSender(senderId: string, phoneNumber: string): Promise<any> {
  return zavuFetch(`/senders/${senderId}/phone-numbers`, {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  });
}
"""

if 'export async function searchAvailableNumbers' not in content:
    target = 'export async function connectTelegram'
    content = content.replace(target, injection + "\n" + target)
    with open(client_file, 'w') as f:
        f.write(content)
    print("Patched client.ts successfully")

# Update voice/route.ts
voice_file = '../API/src/app/api/integrations/zavu/voice/route.ts'
with open(voice_file, 'r') as f:
    voice_content = f.read()

if 'import { createSender' in voice_content and 'purchaseNumber' not in voice_content:
    voice_content = voice_content.replace(
        'import { createSender, attachSenderToAgent, ensureProjectWebhook } from "@/lib/services/zavu";',
        'import { createSender, attachSenderToAgent, ensureProjectWebhook, purchaseNumber, assignNumberToSender } from "@/lib/services/zavu";'
    )

if 'await attachSenderToAgent(sender.id);' in voice_content and 'await purchaseNumber' not in voice_content:
    injection_voice = """      // Comprar el número y asignarlo al sender
      if (phoneNumber) {
        try {
          await purchaseNumber(phoneNumber);
        } catch (e: any) {
          console.warn("[Zavu Voice] Number might already be purchased or error buying:", e.message);
        }
        await assignNumberToSender(sender.id, phoneNumber);
      }
      
      await attachSenderToAgent(sender.id);"""
    voice_content = voice_content.replace('await attachSenderToAgent(sender.id);', injection_voice)
    with open(voice_file, 'w') as f:
        f.write(voice_content)
    print("Patched voice/route.ts successfully")

# Update senders/[id]/route.ts
senders_file = '../API/src/app/api/integrations/zavu/senders/[id]/route.ts'
with open(senders_file, 'r') as f:
    senders_content = f.read()

if 'releaseNumber' not in senders_content:
    senders_content = senders_content.replace(
        'import { deleteSender, detachSenderFromAgent } from "@/lib/services/zavu";',
        'import { deleteSender, detachSenderFromAgent, releaseNumber } from "@/lib/services/zavu";'
    )
    
    senders_content = senders_content.replace(
        'const { id } = await params;',
        'const { id } = await params;\n    const searchParams = _request.nextUrl.searchParams;\n    const phoneNumber = searchParams.get("phoneNumber");'
    )

    senders_content = senders_content.replace(
        'await detachSenderFromAgent(id);',
        'await detachSenderFromAgent(id);\n    if (phoneNumber) {\n      try {\n        await releaseNumber(phoneNumber);\n      } catch (e) {\n        console.warn("[Zavu] Failed to release number:", e);\n      }\n    }'
    )
    with open(senders_file, 'w') as f:
        f.write(senders_content)
    print("Patched senders/[id]/route.ts successfully")

# Create phone-numbers/available/route.ts
available_file = '../API/src/app/api/integrations/zavu/phone-numbers/available/route.ts'
available_content = """import { NextRequest, NextResponse } from "next/server";
import { searchAvailableNumbers } from "@/lib/services/zavu";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get("countryCode");
    const areaCode = searchParams.get("areaCode");
    const smsEnabled = searchParams.get("smsEnabled") === "true";
    const voiceEnabled = searchParams.get("voiceEnabled") === "true";

    if (!countryCode) {
      return NextResponse.json({ error: "countryCode is required" }, { status: 400 });
    }

    const data = await searchAvailableNumbers({ 
      countryCode, 
      areaCode: areaCode || undefined,
      smsEnabled,
      voiceEnabled
    });

    return NextResponse.json(data.items || data.results || data);
  } catch (error: any) {
    console.error("[Zavu PhoneNumbers] Error searching available numbers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search phone numbers" },
      { status: error.status || 500 }
    );
  }
}
"""
import os
os.makedirs(os.path.dirname(available_file), exist_ok=True)
with open(available_file, 'w') as f:
    f.write(available_content)
print("Created phone-numbers/available/route.ts successfully")

