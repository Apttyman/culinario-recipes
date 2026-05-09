// Hardcoded client for project upofudganvjbdhxxpfti.
// Bypasses the auto-generated @/integrations/supabase/client (which is pinned
// to the wrong project by Lovable's .env). Do not switch back.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://upofudganvjbdhxxpfti.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwb2Z1ZGdhbnZqYmRoeHhwZnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjc2OTUsImV4cCI6MjA5Mzc0MzY5NX0.SfVl4GsGx1AJIE-3r1-2ahDIpXDrShIM9lwsRR1NNSQ";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});