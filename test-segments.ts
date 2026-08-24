import { getSegments } from "./app/segments/actions.ts";
import { createClient } from "./lib/supabase/client.ts";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function test() {
  const site_id = "fb1249b6-8f38-4e8c-8be9-e0d5a3eb42fa"; // random valid UUID
  console.log("Calling getSegments...");
  const res = await getSegments(site_id);
  console.log("Result:", res);
}

test().catch(e => console.error("Script error:", e));