// Three-recipe generation via Lovable AI Gateway (Gemini)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertNotForbiddenBackend, TARGET_SUPABASE_ANON_KEY, TARGET_SUPABASE_URL } from "../_shared/target-project.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICES: Record<string, { name: string; desc: string }> = {
  nonna: { name: "Nonna", desc: "warm Italian grandmother, prescriptive about technique, calls cook 'caro/cara', occasional Italian" },
  health_inspector: { name: "The Health Inspector", desc: "clinical, terse, food safety and precision, numerals over words" },
  tom_ford_intern: { name: "The Tom Ford Intern", desc: "aspirational, name-drops obscure ingredients, faintly judgmental, never warm" },
  bike_messenger: { name: "The Bike Messenger", desc: "fast fragmentary sentences, low-effort high-flavor, comfortable with substitutions" },
  monk: { name: "The Monk", desc: "spare, contemplative, single-sentence steps, present language" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id required");

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

    const { data: session, error: sErr } = await userClient
      .from("fridge_sessions")
      .select("id,user_id,detected_ingredients,clarified_ingredients,modifier,cooked_for,time_budget,surprise_for_session")
      .eq("id", session_id).single();
    if (sErr || !session) throw new Error(sErr?.message ?? "session not found");
    const uid = session.user_id;

    const [{ data: profile }, { data: kp }, { data: pantry }, { data: people }, { data: chefs }, { data: cuisines }, { data: portrait }, { data: signals }] = await Promise.all([
      userClient.from("profiles").select("display_name,kitchen_voice").eq("id", uid).maybeSingle(),
      userClient.from("kitchen_profiles").select("*").eq("user_id", uid).maybeSingle(),
      userClient.from("pantry_items").select("name,category").eq("user_id", uid).eq("always_stocked", true),
      session.cooked_for?.length
        ? userClient.from("people").select("id,name,dietary_constraints,dislikes,comfort_food_tag").in("id", session.cooked_for)
        : Promise.resolve({ data: [] as any[] }),
      userClient.from("chef_preferences").select("chef_name").eq("user_id", uid),
      userClient.from("cuisine_preferences").select("cuisine_name").eq("user_id", uid),
      userClient.from("taste_portraits").select("*").eq("user_id", uid).maybeSingle(),
      userClient.from("preference_signals").select("axis,signal_text,signal_weight,source,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(80),
    ]);

    const voiceSlug = profile?.kitchen_voice ?? "nonna";
    const voice = VOICES[voiceSlug] ?? VOICES.nonna;
    const ingredients = (session.clarified_ingredients ?? session.detected_ingredients)?.ingredients ?? [];
    const ingNames = ingredients.map((i: any) => `${i.name}${i.quantity_estimate ? ` (${i.quantity_estimate})` : ""}`);
    const peopleStr = (people ?? []).map((p: any) => {
      const bits = [p.name];
      if (p.dietary_constraints?.length) bits.push(`diet: ${p.dietary_constraints.join(", ")}`);
      if (p.dislikes?.length) bits.push(`dislikes: ${p.dislikes.join(", ")}`);
      return bits.join("; ");
    }).join(" | ") || "themselves";

    // Build preferences block from signals (most recent first, grouped by axis)
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

    const buckWild = (session.detected_ingredients as any)?.buck_wild === true;
    const SYSTEM = `You are a cooking assistant generating exactly 3 distinct recipes. Stay in voice character ${voice.name} (${voice.desc}) for the voice_lines.${preferencesBlock}\n\nReturn ONLY JSON: an array of 3 recipe objects.`;

    const surpriseBudget = typeof session.surprise_for_session === "number"
      ? session.surprise_for_session
      : (portrait?.surprise_tolerance ?? 25);

    const portraitSummary = portrait ? JSON.stringify({
      synthesis_count: portrait.synthesis_count,
      flavor_preferences: portrait.flavor_preferences,
      technique_preferences: portrait.technique_preferences,
      cuisine_patterns: portrait.cuisine_patterns,
      time_patterns: portrait.time_patterns,
      seasonal_patterns: portrait.seasonal_patterns,
      people_patterns: portrait.people_patterns,
      notable_observations: (portrait.notable_observations ?? []).filter((o: any) => !o?.dismissed),
    }, null, 2) : "(no portrait yet — early user)";

    const ingredientsLine = buckWild
      ? `- No specific ingredients tonight — the cook wants you to choose freely, drawing on global cuisine and their preferences.`
      : `- Confirmed ingredients on hand (from photos): ${ingNames.join(", ") || "(none)"}`;

    const ingredientRules = buckWild
      ? `RULES (BUCK-WILD MODE):
- Respect the appliance list and dietary constraints absolutely.
- You may draw on a normal home pantry and groceries — do not require staying within the listed pantry.
- Mark each ingredient with "from": "pantry" or "fridge" reasonably; "shopping" is allowed for new items.`
      : `HARD INGREDIENT RULES — NON-NEGOTIABLE:
- You may ONLY use ingredients from the "Confirmed ingredients on hand" list above and the "Pantry always available" list. Nothing else.
- DO NOT invent, assume, or add any ingredient the user has not confirmed (no "shopping" items, no "you probably have", no aromatics/dairy/proteins/produce that aren't listed).
- Water, salt, and black pepper are the only universally-assumed exceptions.
- Every entry in "ingredients" must have "from" set to either "fridge" (must appear in confirmed list) or "pantry" (must appear in pantry list). The value "shopping" is forbidden.
- If you genuinely cannot make 3 distinct recipes from what's available, return fewer recipes — never pad with assumed ingredients.`;

    const userPrompt = `USER CONTEXT:
- Display name: ${profile?.display_name ?? "—"}
- Kitchen voice: ${voice.name} — ${voice.desc}
- Stove: ${kp?.stove_type ?? "unknown"}
- Appliances: ${(kp?.appliances ?? []).join(", ") || "(none)"}
- Default fat: ${kp?.default_fat ?? "—"}
- Default acid: ${kp?.default_acid ?? "—"}
- Pantry always available: ${(pantry ?? []).map((p: any) => p.name).join(", ") || "(none)"}
- Chef inspirations: ${(chefs ?? []).map((c: any) => c.chef_name).join(", ") || "(none)"}
- Cuisines: ${(cuisines ?? []).map((c: any) => c.cuisine_name).join(", ") || "(none)"}

LEARNED TASTE PORTRAIT (system's current understanding, built from rated history):
${portraitSummary}

Use this portrait as the primary guide for recipe selection. The user's stated chef and cuisine preferences (above) are initial defaults; the learned portrait is what they've actually been showing they like in practice.

SURPRISE BUDGET: ${surpriseBudget}/100
The surprise budget is the probability that one of the 3 recipes should deliberately depart from the user's taste portrait. At 0, all 3 stay tightly in their zone. At 100, one of the 3 is always a confident departure. Use this to decide whether to include a wildcard recipe. If you include a wildcard, mark it in the recipe response with "is_wildcard": true and "wildcard_rationale": "string explaining why this might pleasantly surprise them despite being outside their usual zone".

TONIGHT:
- Cooking for: ${peopleStr}
- Time budget: ${session.time_budget ?? "weeknight"}
${ingredientsLine}

OPTIONAL MODIFIER (HARD CONSTRAINT if present, preferences inform style only after this constraint is met):
${session.modifier?.trim() || "none — use preferences freely"}

${ingredientRules}

INGREDIENT FORMAT (STRICT):
Each ingredient has a single "amount" field — a complete human-readable measurement string that ALWAYS includes a usable unit.
Examples: "2 tablespoons", "1 cup", "1 lb", "3 cloves", "1 medium", "2 large", "to taste", "a pinch", "as needed".
NEVER return a bare number with no unit (no "1", no "0.5"). NEVER return amount and unit as separate fields.
For countable items (eggs, garlic, lemons) use "1 medium", "3 cloves", "2 large", etc. For flexible quantities use "to taste", "a pinch", or "as needed".

Return JSON array of up to 3 objects, each with this exact shape:
{"title":"string","chef_inspiration":"string|null","cuisine":"string","time_estimate_minutes":0,"difficulty":"quick|weeknight|project|use-up","rationale":"string","ingredients":[{"item":"string","amount":"string","from":"fridge|pantry"}],"steps":["string"],"notes":"string","is_wildcard":false,"wildcard_rationale":null,"voice_lines":{"intro_line":"string","success_line":"string"}}
Recipes must feel intentionally different — vary technique, time, mood. Voice lines stay in character, under 20 words each. Return ONLY the JSON array.`;

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
      if (aiResp.status === 429) throw new Error("Rate limited. Try again in a moment.");
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
    if (!Array.isArray(parsed)) throw new Error("expected array of recipes");
    // Whitelist enforcement: drop recipes that use ingredients the user hasn't confirmed
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const allowed = new Set<string>([
      "water", "salt", "pepper", "black pepper", "kosher salt", "sea salt",
      ...ingredients.map((i: any) => norm(i.name ?? "")),
      ...(pantry ?? []).map((p: any) => norm(p.name ?? "")),
    ].filter(Boolean));
    const isAllowed = (item: string) => {
      const n = norm(item);
      if (!n) return false;
      if (allowed.has(n)) return true;
      // allow partial matches (e.g. "yellow onion" vs "onion")
      for (const a of allowed) {
        if (a && (n.includes(a) || a.includes(n))) return true;
      }
      return false;
    };
    const recipes = (buckWild ? parsed : parsed.filter((r: any) => {
      const items = Array.isArray(r?.ingredients) ? r.ingredients : [];
      return items.length > 0 && items.every((it: any) => isAllowed(it?.item ?? ""));
    })).slice(0, 3);
    if (recipes.length === 0) {
      return new Response(JSON.stringify({
        error: "Not enough confirmed ingredients to generate recipes without making assumptions. Add more items or take additional photos.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const inserted: string[] = [];
    for (let i = 0; i < recipes.length; i++) {
      const r = recipes[i];
      const { data: row, error: insErr } = await userClient.from("recipes").insert({
        user_id: uid,
        session_id,
        title: r.title ?? "Untitled",
        body: { ingredients: r.ingredients, steps: r.steps, notes: r.notes, rationale: r.rationale },
        position: i + 1,
        chef_inspiration: r.chef_inspiration ?? null,
        cuisine: r.cuisine ?? null,
        time_estimate_minutes: r.time_estimate_minutes ?? null,
        difficulty: r.difficulty ?? null,
        is_wildcard: !!r.is_wildcard,
        wildcard_rationale: r.is_wildcard ? (r.wildcard_rationale ?? null) : null,
      }).select("id").single();
      if (insErr) throw insErr;
      inserted.push(row.id);
      if (r.voice_lines) {
        await userClient.from("recipe_voice_lines").insert({
          recipe_id: row.id,
          voice_character: voiceSlug,
          intro_line: r.voice_lines.intro_line ?? null,
          success_line: r.voice_lines.success_line ?? null,
        });
      }
    }

    return new Response(JSON.stringify({ recipe_ids: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[generate-recipes]", e);
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});