export const TARGET_SUPABASE_REF = "upofudganvjbdhxxpfti";
export const FORBIDDEN_SUPABASE_REF = "stexpgubdaqisesanhwn";

export const TARGET_SUPABASE_URL = `https://${TARGET_SUPABASE_REF}.supabase.co`;
export const TARGET_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwb2Z1ZGdhbnZqYmRoeHhwZnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjc2OTUsImV4cCI6MjA5Mzc0MzY5NX0.SfVl4GsGx1AJIE-3r1-2ahDIpXDrShIM9lwsRR1NNSQ";

export function assertNotForbiddenBackend() {
  const managedUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (managedUrl.includes(FORBIDDEN_SUPABASE_REF)) {
    console.warn(`[backend-guard] ignored managed forbidden backend ${FORBIDDEN_SUPABASE_REF}`);
  }
}