// Inverse mode: generate 3 recipes a chosen celebrity would pick, in their voice,
// with a memoir-style blurb and a cameo from the user's kitchen voice character.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertNotForbiddenBackend, TARGET_SUPABASE_ANON_KEY, TARGET_SUPABASE_URL } from "../_shared/target-project.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICES: Record<string, { name: string; desc: string }> = {
  nonna: { name: "Nonna", desc: "warm Italian grandmother" },
  health_inspector: { name: "The Health Inspector", desc: "clinical, terse" },
  tom_ford_intern: { name: "The Tom Ford Intern", desc: "aspirational, faintly judgmental" },
  bike_messenger: { name: "The Bike Messenger", desc: "fast, fragmentary, low-effort high-flavor" },
  monk: { name: "The Monk", desc: "spare, contemplative" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { celebrity } = await req.json();
    const celeb = String(celebrity ?? "").trim();
    if (!celeb) throw new Error("celebrity required");

    assertNotForbiddenBackend();
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUrl = TARGET_SUPABASE_URL;
    const supaAnon = TARGET_SUPABASE_ANON_KEY;
    const geminiKey = Deno.env.get("GEMINI");
    if (!geminiKey) throw new Error("GEMINI key missing");

    const userClient = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) throw new Error("not authenticated");

    const { data: profile } = await userClient
      .from("profiles").select("display_name,kitchen_voice").eq("id", uid).maybeSingle();
    const voiceSlug = profile?.kitchen_voice ?? "nonna";
    const voice = VOICES[voiceSlug] ?? VOICES.nonna;

    const SYSTEM = `You are running INVERSE MODE for a thoughtful cooking app. The user picks a person — real, fictional, dead, alive, or personal. You must imagine exactly 3 recipes that PERSON would actually choose to cook or eat, drawn from their life, taste, milieu, era, and obsessions. Write each recipe IN THAT PERSON'S VOICE. The "blurb" is a short memoir-style passage (2–3 sentences) explaining why this person picks this dish — specific, true to them, never generic. Include one cameo line from the user's kitchen voice character (${voice.name} — ${voice.desc}) reacting to the pick. Return ONLY valid JSON shaped as {"recipes":[...]}.`;

    const userPrompt = `THE PERSON: ${celeb}

Pick 3 distinct recipes this person would actually choose — different moods, different times of day or seasons, things that feel true to who they are. Avoid the obvious cliché unless the cliché is genuinely revealing.

INGREDIENT FORMAT (STRICT):
Each ingredient has a single "amount" field — a complete human-readable measurement string that ALWAYS includes a usable unit.
Examples: "2 tablespoons", "1 cup", "1 lb", "3 cloves", "1 medium", "2 large", "to taste", "a pinch", "as needed".
NEVER return a bare number with no unit (no "1", no "0.5"). NEVER return amount and unit as separate fields.
For countable items (eggs, garlic, lemons) use "1 medium", "3 cloves", "2 large", etc. For flexible quantities use "to taste", "a pinch", or "as needed".

Return a JSON object with exactly this shape:
{"recipes":[{"title":"string","cuisine":"string","time_estimate_minutes":0,"difficulty":"quick|weeknight|project|use-up","blurb":"2-3 sentence memoir-style blurb in the person's voice explaining why this dish","ingredients":[{"item":"string","amount":"string","from":"pantry|shopping"}],"steps":["string"],"voice_cameo":"one short line from ${voice.name} reacting to the pick, in character"}]}

The "blurb" is the soul of inverse mode — make it sing. Concrete, specific, in their voice. Steps can be brisk; this is whimsy, not a culinary school worksheet. Return ONLY the JSON object. The recipes array MUST contain exactly 3 recipes.`;

    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "The kitchen is busy — too many conjurings at once. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`gemini ${aiResp.status}: ${txt.slice(0, 300)}`);
    }
    const aiJson = await aiResp.json();
    const raw: string = aiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (!m) throw new Error("non-JSON response");
      parsed = JSON.parse(m[0]);
    }
    // Gateway json_object should return { recipes: [...] }, but keep the old
    // array unwrapping as a fallback for already-deployed prompt variants.
    if (!Array.isArray(parsed)) {
      if (Array.isArray(parsed?.recipes)) parsed = parsed.recipes;
      else if (parsed && typeof parsed === "object") {
        const arr = Object.values(parsed).find((v) => Array.isArray(v));
        if (Array.isArray(arr)) parsed = arr;
      }
    }
    if (!Array.isArray(parsed)) throw new Error("expected array");
    const recipes = parsed.filter((r: any) => r && typeof r === "object").slice(0, 3);
    if (recipes.length !== 3) throw new Error(`AI returned ${recipes.length} recipes instead of 3`);

    const inserted: string[] = [];
    const inverseGenerationId = crypto.randomUUID();
    for (let i = 0; i < recipes.length; i++) {
      const r = recipes[i];
      const { data: row, error: insErr } = await userClient.from("recipes").insert({
        user_id: uid,
        session_id: null,
        title: r.title ?? "Untitled",
        body: {
          ingredients: r.ingredients ?? [],
          steps: r.steps ?? [],
          rationale: r.blurb ?? null,
          inverse_blurb: r.blurb ?? null,
          cameo: r.voice_cameo ?? null,
          inverse_celebrity: celeb,
          inverse_generation_id: inverseGenerationId,
        },
        position: i + 1,
        chef_inspiration: celeb,
        cuisine: r.cuisine ?? null,
        time_estimate_minutes: r.time_estimate_minutes ?? null,
        difficulty: r.difficulty ?? null,
        is_wildcard: false,
      }).select("id").single();
      if (insErr) throw insErr;
      inserted.push(row.id);
      if (r.voice_cameo) {
        await userClient.from("recipe_voice_lines").insert({
          recipe_id: row.id,
          voice_character: voiceSlug,
          intro_line: r.voice_cameo,
          success_line: null,
        });
      }
    }

    return new Response(JSON.stringify({ recipe_ids: inserted, celebrity: celeb, inverse_generation_id: inverseGenerationId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[generate-inverse-recipes]", e);
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});