import { supabase } from "@/lib/supabase-client";

// Awaits the synthesize-portrait edge function and logs the resolved response.
// Never throws — synthesis failures must not break user actions.
export async function triggerPortraitSynthesis() {
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
