import { supabase } from "@/lib/supabase-client";

// Fire-and-forget: invoke the synthesize-portrait edge function in the
// background. Never throw — synthesis failures must not break user actions.
export function triggerPortraitSynthesis() {
  console.log("[portrait] triggerPortraitSynthesis() called");
  try {
    const p = supabase.functions.invoke("synthesize-portrait", { body: {} });
    console.log("[portrait] invoke() returned", p);
    void p.then(
      (res) => {
        console.log("[portrait] synthesis response", res);
        if (res?.error) console.warn("[portrait] synthesis error", res.error);
      },
      (e) => console.warn("[portrait] synthesis threw", e),
    );
  } catch (e) {
    console.warn("[portrait] synthesis invoke failed (sync throw)", e);
  }
}
