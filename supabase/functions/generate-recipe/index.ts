// MiniMax-M2.7 recipe generation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertNotForbiddenBackend, TARGET_SUPABASE_ANON_KEY, TARGET_SUPABASE_URL } from "../_shared/target-project.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICES: Record<string, string> = {
  nonna:
    "You are Nonna — a warm Italian grandmother. Prescriptive about technique. Scold shortcuts gently. Address the cook as 'caro' or 'cara'. Slip in occasional Italian.",
  health_inspector:
    "You are The Health Inspector — clinical, terse, focused on food safety and precision. Reference temperatures and times in numerals. No flourishes.",
  tom_ford_intern:
    "You are The Tom Ford Intern — aspirational, name-drop obscure ingredients, treat every dish as an aesthetic statement. Faintly judgmental, never warm.",
  bike_messenger:
    "You are The Bike Messenger — fast, fragmentary sentences. Low-effort high-flavor pragmatism. Comfortable with substitutions. No fluff.",
  monk:
    "You are The Monk — spare, contemplative. Cooking is practice. Single-sentence steps. Quiet, present language.",
};

const AMOUNT_RULE = `INGREDIENT FORMAT (STRICT):
Each ingredient has a single "amount" field — a complete human-readable measurement string that ALWAYS includes a usable unit.
Examples: "2 tablespoons", "1 cup", "1 lb", "3 cloves", "1 medium", "to taste", "a pinch", "as needed".
NEVER return a bare number with no unit (no "1", no "0.5"). NEVER return amount and unit as separate fields.
For countable items (eggs, garlic, lemons) use "1 medium", "3 cloves", "2 large", etc.
For flexible quantities use "to taste", "a pinch", or "as needed".`;

const OUTPUT_SHAPE = `${AMOUNT_RULE}

Return ONLY valid JSON, no preamble, in this exact shape:
{"title":"string","voice_slug":"string","servings":2,"total_time_minutes":35,"ingredients":[{"name":"string","amount":"string","note":null}],"steps":[{"index":1,"text":"string"}],"voice_intro":"string|null","voice_outro":"string|null"}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id, voice_slug, cooking_for } = await req.json();
    if (!session_id) throw new Error("session_id required");
    const voice = VOICES[voice_slug] ? voice_slug : "nonna";
    const peopleIds: string[] = Array.isArray(cooking_for) ? cooking_for : [];

    assertNotForbiddenBackend();
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUrl = TARGET_SUPABASE_URL;
    const supaAnon = TARGET_SUPABASE_ANON_KEY;
    const minimaxKey = Deno.env.get("MINIMAX");
    if (!minimaxKey) throw new Error("MINIMAX secret not configured");

    const userClient = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: sessionRow, error: sErr } = await userClient
      .from("fridge_sessions")
      .select("id, user_id, detected_ingredients")
      .eq("id", session_id)
      .single();
    if (sErr || !sessionRow) throw new Error(sErr?.message ?? "session not found");
    const userId = sessionRow.user_id;

    const [{ data: kp }, { data: pantry }, { data: people }, { data: signals }] = await Promise.all([
      userClient.from("kitchen_profiles").select("*").eq("user_id", userId).maybeSingle(),
      userClient.from("pantry_items").select("name, category").eq("user_id", userId).eq("always_stocked", true),
      peopleIds.length
        ? userClient.from("people").select("id, name, dietary_constraints, dislikes, comfort_food_tag").in("id", peopleIds)
        : Promise.resolve({ data: [] as any[] }),
      userClient.from("preference_signals").select("axis,signal_text,signal_weight").eq("user_id", userId).order("created_at", { ascending: false }).limit(80),
    ]);

    const detectedRaw: any = sessionRow.detected_ingredients ?? {};
    const buckWild = detectedRaw?.buck_wild === true;
    const detected = detectedRaw?.ingredients ?? [];
    const detectedNames = detected.map((i: any) => i.name).filter(Boolean);
    const pantryNames = (pantry ?? []).map((p: any) => p.name);

    const peopleSummary = (people ?? []).map((p: any) => {
      const bits = [p.name];
      if (p.dietary_constraints?.length) bits.push(`(diet: ${p.dietary_constraints.join(", ")})`);
      if (p.dislikes?.length) bits.push(`(dislikes: ${p.dislikes.join(", ")})`);
      if (p.comfort_food_tag) bits.push(`(comfort: ${p.comfort_food_tag})`);
      return bits.join(" ");
    });

    const sigList = (signals ?? []) as any[];
    let preferencesBlock = "";
    if (sigList.length >= 5) {
      const byAxis: Record<string, string[]> = {};
      for (const s of sigList.slice(0, 250)) {
        const ax = s.axis || "general";
        const w = typeof s.signal_weight === "number" ? s.signal_weight : 1;
        const prefix = w < 0 ? "AVOID — " : "";
        (byAxis[ax] ||= []).push(`${prefix}${s.signal_text}`);
      }
      const lines = Object.entries(byAxis).map(([ax, items]) => `- ${ax}: ${items.slice(0, 20).join("; ")}`);
      preferencesBlock = `\n\nThe cook's known preferences (from past choices, ratings, and questions):\n${lines.join("\n")}\n\nBias the recipe toward the cook's preferences where it does not conflict with the dietary constraints of the people they're cooking for. Dietary constraints are absolute; preferences are tendencies.`;
    }

    const ingredientsLine = buckWild
      ? `No specific ingredients tonight — the cook wants you to choose freely, drawing on global cuisine and their preferences.`
      : `Detected ingredients: ${detectedNames.join(", ") || "(none)"}`;
    const pantryLine = buckWild
      ? `Pantry: assume a normal home pantry (no strict constraint).`
      : `Always-stocked pantry: ${pantryNames.join(", ") || "(none)"}`;

    const userPrompt = [
      ingredientsLine,
      pantryLine,
      `Stove: ${kp?.stove_type ?? "unknown"}. Appliances: ${(kp?.appliances ?? []).join(", ") || "(none)"}.`,
      `Default fat: ${kp?.default_fat ?? "—"}. Default acid: ${kp?.default_acid ?? "—"}.`,
      `Cooking for: ${peopleSummary.join("; ") || "just the cook"}.`,
      ``,
      `Compose ONE recipe in your voice for tonight. Set voice_slug to "${voice}". ${buckWild ? "Choose freely; respect dietary constraints absolutely." : "Use detected ingredients as the heart of the dish; lean on pantry for seasoning. Respect dietary constraints absolutely."} Keep voice_intro and voice_outro short — one or two sentences in your character's voice.`,
      OUTPUT_SHAPE,
    ].join("\n");

    const mmResp = await fetch("https://api.minimax.io/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${minimaxKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "MiniMax-M2.7",
        messages: [
          { role: "system", content: `${VOICES[voice]}${preferencesBlock}` },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!mmResp.ok) {
      const txt = await mmResp.text();
      console.error("[generate-recipe] minimax error", mmResp.status, txt);
      throw new Error(`minimax ${mmResp.status}: ${txt.slice(0, 300)}`);
    }
    const mmJson = await mmResp.json();
    const raw: string = mmJson?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("model returned non-JSON: " + cleaned.slice(0, 200));
      parsed = JSON.parse(m[0]);
    }
    parsed.voice_slug = voice;

    const { data: inserted, error: insErr } = await userClient
      .from("recipes")
      .insert({
        user_id: userId,
        session_id,
        title: parsed.title ?? "Untitled",
        body: parsed,
        cooked_for: peopleIds.length ? peopleIds : null,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("[generate-recipe] insert failed", insErr);
      throw insErr;
    }

    return new Response(JSON.stringify({ recipe_id: inserted.id, recipe: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[generate-recipe] failed", e);
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});