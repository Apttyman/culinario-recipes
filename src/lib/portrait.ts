import { supabase } from "@/lib/supabase-client";

// Awaits the synthesize-portrait edge function and logs the resolved response.
// Never throws — synthesis failures must not break user actions.
//
// Gating:
// 1. force=true → always run.
// 2. No prior synthesis → always run.
// 3. Last synthesis today → skip.
// 4. Last synthesis on prior day with no new recipes/signals/corrections since → skip.
// 5. Otherwise → run.
export async function triggerPortraitSynthesis(force = false) {
  if (!force) {
    const { data: portrait } = await supabase
      .from("taste_portraits")
      .select("last_synthesis_at, synthesis_count")
      .maybeSingle();

    if (portrait?.last_synthesis_at) {
      const lastSynth = new Date(portrait.last_synthesis_at);
      const today = new Date();
      const sameCalendarDay =
        lastSynth.getFullYear() === today.getFullYear() &&
        lastSynth.getMonth() === today.getMonth() &&
        lastSynth.getDate() === today.getDate();

      if (sameCalendarDay) {
        console.log("[portrait] synthesis skipped (already ran today)", {
          last_synthesis_at: portrait.last_synthesis_at,
        });
        return { data: { skipped: true, reason: "already_ran_today" }, error: null };
      }

      const lastSynthIso = portrait.last_synthesis_at;
      const [
        { count: newRecipes },
        { count: newSignals },
        { count: newCorrections },
      ] = await Promise.all([
        supabase
          .from("recipes")
          .select("id", { count: "exact", head: true })
          .gt("created_at", lastSynthIso),
        supabase
          .from("preference_signals")
          .select("id", { count: "exact", head: true })
          .gt("created_at", lastSynthIso),
        supabase
          .from("portrait_corrections")
          .select("id", { count: "exact", head: true })
          .gt("created_at", lastSynthIso),
      ]);

      const hasChanges =
        (newRecipes ?? 0) > 0 ||
        (newSignals ?? 0) > 0 ||
        (newCorrections ?? 0) > 0;

      if (!hasChanges) {
        console.log("[portrait] synthesis skipped (no changes since last synthesis)", {
          last_synthesis_at: portrait.last_synthesis_at,
          newRecipes, newSignals, newCorrections,
        });
        return { data: { skipped: true, reason: "no_changes" }, error: null };
      }

      console.log("[portrait] gating passed, running synthesis", {
        newRecipes, newSignals, newCorrections,
      });
    }
  }

  console.log("[portrait] triggerPortraitSynthesis() called");
  try {
    const { data, error } = await supabase.functions.invoke("synthesize-portrait", { body: {} });
    console.log("[portrait] synthesis resolved", { data, error });
    if (error) console.error("[portrait] synthesis error", error);
    return { data, error };
  } catch (e) {
    console.error("[portrait] synthesis threw", e);
    return { data: null, error: e };
  }
}
