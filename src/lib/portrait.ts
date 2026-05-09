import { supabase } from "@/lib/supabase-client";

// Fire-and-forget: invoke the synthesize-portrait edge function in the
// background. Never throw — synthesis failures must not break user actions.
export function triggerPortraitSynthesis() {
  try {
    void supabase.functions.invoke("synthesize-portrait", { body: {} }).then(
      ({ error }) => {
        if (error) console.warn("[portrait] synthesis error", error);
      },
      (e) => console.warn("[portrait] synthesis threw", e),
    );
  } catch (e) {
    console.warn("[portrait] synthesis invoke failed", e);
  }
}