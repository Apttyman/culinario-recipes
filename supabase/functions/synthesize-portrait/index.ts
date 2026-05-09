// Resynthesizes a user's taste portrait via Lovable AI Gateway (gemini-2.5-pro).
// Reads the full cooking history, prior portrait, and corrections, then writes
// a new structured portrait back to taste_portraits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertNotForbiddenBackend, TARGET_SUPABASE_ANON_KEY, TARGET_SUPABASE_URL } from "../_shared/target-project.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) throw new Error("not authenticated");
    const uid = userData.user.id;

    const [
      { data: prevPortrait },
      { data: recipes },
      { data: voiceLines },
      { data: sessions },
      { data: chefs },
      { data: cuisines },
      { data: people },
      { data: corrections },
    ] = await Promise.all([
      userClient.from("taste_portraits").select("*").eq("user_id", uid).maybeSingle(),
      userClient.from("recipes")
        .select("id,title,cuisine,chef_inspiration,difficulty,time_estimate_minutes,rating,notes,cooked_at,cooked_for,created_at,is_wildcard,body")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
      userClient.from("recipe_voice_lines").select("recipe_id,voice_character"),
      userClient.from("fridge_sessions").select("id,modifier,time_budget,surprise_for_session,created_at")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(100),
      userClient.from("chef_preferences").select("chef_name").eq("user_id", uid),
      userClient.from("cuisine_preferences").select("cuisine_name").eq("user_id", uid),
      userClient.from("people").select("id,name,dietary_constraints,dislikes,comfort_food_tag").eq("user_id", uid),
      userClient.from("portrait_corrections").select("correction_text,applied_to_field,observation_text,created_at")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
    ]);

    const ratedCount = (recipes ?? []).filter((r: any) => r.rating != null).length;

    const compactRecipes = (recipes ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      cuisine: r.cuisine,
      chef: r.chef_inspiration,
      difficulty: r.difficulty,
      mins: r.time_estimate_minutes,
      rating: r.rating,
      notes: r.notes,
      cooked_at: r.cooked_at,
      cooked_for: r.cooked_for,
      created_at: r.created_at,
      wildcard: r.is_wildcard,
      ingredients: (r.body?.ingredients ?? []).map((i: any) => i?.item).filter(Boolean).slice(0, 24),
      steps_summary: (r.body?.steps ?? []).slice(0, 2).join(" | ").slice(0, 240),
    }));

    const peopleById: Record<string, string> = Object.fromEntries((people ?? []).map((p: any) => [p.id, p.name]));

    const SYSTEM = `You are maintaining a structured taste portrait for a cooking diary user. You'll receive their previous portrait, their full cooking history, and any corrections they've made. Update the portrait. Be honest, observant, and willing to revise inferences when evidence shifts.

Rules for inference:
- Need at least 3 instances before claiming a "love" or "dislike" with confidence >0.7
- Honor corrections in portrait_corrections — they are ground truth
- Don't repeat observations the user has dismissed (any prior observation marked dismissed:true)
- "Emerging" preferences are signals with 1-2 instances — useful but uncertain
- Notable observations should be specific and surprising, not generic ("user likes savory food" is useless)
- Always include the supporting recipe IDs so the user can verify the inference
- Be willing to revise: if evidence shifts, change confidence scores and remove old observations
- Return ONLY a JSON object matching the requested shape, no preamble.`;

    const userPrompt = `PREVIOUS PORTRAIT:
${JSON.stringify(prevPortrait ?? {}, null, 2)}

COOKING HISTORY (most recent first, up to 200):
${JSON.stringify(compactRecipes, null, 2)}

VOICE LINES SAVED PER RECIPE:
${JSON.stringify(voiceLines ?? [], null, 2)}

SESSIONS (modifier + brief context):
${JSON.stringify(sessions ?? [], null, 2)}

STATED CHEF PREFERENCES: ${(chefs ?? []).map((c: any) => c.chef_name).join(", ") || "(none)"}
STATED CUISINE PREFERENCES: ${(cuisines ?? []).map((c: any) => c.cuisine_name).join(", ") || "(none)"}

PEOPLE (id → name):
${JSON.stringify(peopleById, null, 2)}
PEOPLE DETAILS:
${JSON.stringify(people ?? [], null, 2)}

CORRECTIONS THE USER HAS MADE (most recent first):
${JSON.stringify(corrections ?? [], null, 2)}

Return JSON with this exact shape:
{
  "flavor_preferences": {"loves":[{"name":"","confidence":0,"evidence_count":0}], "dislikes":[...], "emerging":[...]},
  "technique_preferences": {"loves":[...], "dislikes":[...], "emerging":[...]},
  "cuisine_patterns": {"<cuisine>":{"avg_rating":0,"count":0,"trend":"rising|stable|declining"}},
  "time_patterns": {"weekday_evenings":{"avg_time_min":0,"dominant_difficulty":""},"weekends":{"avg_time_min":0,"dominant_difficulty":""}},
  "seasonal_patterns": {"current_month_observations":""},
  "people_patterns": {"<person_id_or_name>": "narrative pattern"},
  "notable_observations": [
    {"observation":"specific surprising claim", "confidence":0.0, "supporting_recipes":["recipe_id"], "dismissed": false}
  ]
}

Carry forward any prior notable_observations whose dismissed:true is set in the previous portrait — keep them in the array with dismissed:true so the user's dismissals remain durable. Do not invent supporting_recipes ids; only reference recipe ids that appear in the cooking history.`;

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
      console.error("[synthesize-portrait] gemini error", aiResp.status, txt);
      throw new Error(`gemini ${aiResp.status}: ${txt.slice(0, 300)}`);
    }
    const aiJson = await aiResp.json();
    const raw: string = aiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("non-JSON response");
      parsed = JSON.parse(m[0]);
    }

    // Preserve dismissed flags from previous portrait observations as a safety net
    const prevObs = (prevPortrait?.notable_observations ?? []) as any[];
    const dismissedTexts = new Set(prevObs.filter((o) => o?.dismissed).map((o) => (o.observation ?? "").trim()));
    const newObs = (parsed.notable_observations ?? []).map((o: any) => {
      const isDismissed = !!o.dismissed || dismissedTexts.has((o.observation ?? "").trim());
      return {
        observation: o.observation ?? "",
        confidence: typeof o.confidence === "number" ? o.confidence : 0,
        supporting_recipes: Array.isArray(o.supporting_recipes) ? o.supporting_recipes : [],
        inferred_at: o.inferred_at ?? new Date().toISOString(),
        dismissed: isDismissed,
      };
    });

    const updatePayload = {
      flavor_preferences: parsed.flavor_preferences ?? prevPortrait?.flavor_preferences ?? { loves: [], dislikes: [], emerging: [] },
      technique_preferences: parsed.technique_preferences ?? prevPortrait?.technique_preferences ?? { loves: [], dislikes: [], emerging: [] },
      cuisine_patterns: parsed.cuisine_patterns ?? {},
      time_patterns: parsed.time_patterns ?? {},
      seasonal_patterns: parsed.seasonal_patterns ?? {},
      people_patterns: parsed.people_patterns ?? {},
      notable_observations: newObs,
      synthesis_count: (prevPortrait?.synthesis_count ?? 0) + 1,
      last_synthesis_at: new Date().toISOString(),
      next_synthesis_due_after_ratings: ratedCount + 1,
    };

    if (prevPortrait) {
      const { error: upErr } = await userClient.from("taste_portraits").update(updatePayload).eq("user_id", uid);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await userClient.from("taste_portraits").insert({ user_id: uid, ...updatePayload });
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ ok: true, synthesis_count: updatePayload.synthesis_count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[synthesize-portrait]", e);
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});