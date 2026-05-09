// MiniMax-VL-01 ingredient detection from session photos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertNotForbiddenBackend, TARGET_SUPABASE_ANON_KEY, TARGET_SUPABASE_URL } from "../_shared/target-project.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You identify food ingredients visible in kitchen photos (fridge, pantry, counter).
Use lowercase common names. Ignore non-food items, packaging text, brand names.
Mark items as "low" confidence with alternatives when visually ambiguous (cilantro vs parsley, lemon vs lime, similar cuts of meat, etc).
Return ONLY valid JSON, no preamble, in this exact shape:
{"ingredients":[{"name":"tomato","confidence":"high"},{"name":"cilantro","confidence":"low","alternatives":["parsley","flat-leaf parsley"]}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id required");

    assertNotForbiddenBackend();
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUrl = TARGET_SUPABASE_URL;
    const supaAnon = TARGET_SUPABASE_ANON_KEY;
    const minimaxKey = Deno.env.get("MINIMAX");
    if (!minimaxKey) throw new Error("MINIMAX secret not configured");

    const userClient = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: session, error: sErr } = await userClient
      .from("fridge_sessions")
      .select("id, user_id, photo_urls")
      .eq("id", session_id)
      .single();
    if (sErr || !session) throw new Error(sErr?.message ?? "session not found");

    // photo_urls hold storage paths like {uid}/{sid}/0.jpg
    const signed: string[] = [];
    for (const path of session.photo_urls as string[]) {
      const { data, error } = await userClient.storage
        .from("session-photos")
        .createSignedUrl(path, 60 * 30);
      if (error) {
        console.error("[detect-ingredients] sign url failed", path, error);
        continue;
      }
      if (data?.signedUrl) signed.push(data.signedUrl);
    }
    if (signed.length === 0) throw new Error("no readable photos");

    const userContent: any[] = [
      { type: "text", text: "Identify all food ingredients across these photos. Return JSON only." },
      ...signed.map((u) => ({ type: "image_url", image_url: { url: u } })),
    ];

    const mmResp = await fetch("https://api.minimax.io/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${minimaxKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "MiniMax-VL-01",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
      }),
    });

    if (!mmResp.ok) {
      const txt = await mmResp.text();
      console.error("[detect-ingredients] minimax error", mmResp.status, txt);
      throw new Error(`minimax ${mmResp.status}: ${txt.slice(0, 300)}`);
    }
    const mmJson = await mmResp.json();
    const raw: string = mmJson?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Try to extract first {...} block
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("model returned non-JSON: " + cleaned.slice(0, 200));
      parsed = JSON.parse(m[0]);
    }
    if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
      parsed = { ingredients: [] };
    }

    const { error: upErr } = await userClient
      .from("fridge_sessions")
      .update({ detected_ingredients: parsed })
      .eq("id", session_id);
    if (upErr) console.error("[detect-ingredients] save failed", upErr);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[detect-ingredients] failed", e);
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});