// Generate a celebrity-flavored photograph for an inverse-mode recipe via Imagen.
// Stores the image in the `recipe-images` bucket and writes image_path on the recipe row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertNotForbiddenBackend, TARGET_SUPABASE_ANON_KEY, TARGET_SUPABASE_URL } from "../_shared/target-project.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { recipe_id, dish_description, celebrity } = await req.json();
    if (!recipe_id) throw new Error("recipe_id required");

    assertNotForbiddenBackend();
    const authHeader = req.headers.get("Authorization") ?? "";
    const imagenKey = Deno.env.get("IMAGEN");
    if (!imagenKey) throw new Error("IMAGEN key not configured");

    const userClient = createClient(TARGET_SUPABASE_URL, TARGET_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("not authenticated");

    const { data: recipe, error: recErr } = await userClient
      .from("recipes")
      .select("id, user_id, title, cuisine, body, chef_inspiration, image_path")
      .eq("id", recipe_id)
      .single();
    if (recErr || !recipe) throw new Error("recipe not found");
    if (recipe.user_id !== user.id) throw new Error("forbidden");

    // Reuse existing image if already generated.
    if (recipe.image_path) {
      return new Response(JSON.stringify({ image_path: recipe.image_path, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: any = recipe.body ?? {};
    const celeb = String(celebrity ?? body.inverse_celebrity ?? recipe.chef_inspiration ?? "").trim();
    const blurb = String(dish_description ?? body.inverse_blurb ?? body.rationale ?? "").trim();
    const ingredients = (body.ingredients ?? [])
      .slice(0, 8)
      .map((i: any) => i.item ?? i.name)
      .filter(Boolean)
      .join(", ");

    const prompt = `An editorial overhead food photograph of "${recipe.title}"${
      recipe.cuisine ? `, a ${recipe.cuisine} dish` : ""
    }${celeb ? ` — the dish ${celeb} would choose, plated as if from their world` : ""}. ` +
      (blurb ? `Mood: ${blurb}. ` : "") +
      (ingredients ? `Featuring ${ingredients}. ` : "") +
      `Natural daylight, matte ceramic plate on weathered linen, soft shadows, shallow depth of field, ` +
      `muted earthy palette, no text, no people, magazine cookbook aesthetic, square composition.`;

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${imagenKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: "1:1" },
        }),
      },
    );

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`Imagen error ${aiRes.status}: ${t.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const pred = aiJson?.predictions?.[0];
    const b64: string | undefined = pred?.bytesBase64Encoded;
    if (!b64) throw new Error("no image returned");
    const mime: string = pred?.mimeType ?? "image/png";
    const ext = mime.split("/")[1].split("+")[0];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    const path = `${user.id}/${recipe.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await userClient.storage
      .from("recipe-images")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

    const { error: updErr } = await userClient
      .from("recipes")
      .update({ image_path: path })
      .eq("id", recipe.id);
    if (updErr) throw new Error(`recipe update failed: ${updErr.message}`);

    return new Response(JSON.stringify({ image_path: path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-inverse-image]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
