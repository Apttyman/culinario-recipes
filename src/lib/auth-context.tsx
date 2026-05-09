import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
import { triggerPortraitSynthesis } from "@/lib/portrait";

export type Profile = {
  id: string;
  display_name: string | null;
  kitchen_voice: string | null;
  onboarding_complete: boolean;
};

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const portraitFiredRef = useRef<string | null>(null);

  const maybeFirePortrait = (uid: string) => {
    if (portraitFiredRef.current === uid) return;
    portraitFiredRef.current = uid;
    void triggerPortraitSynthesis().catch(() => {});
  };

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, kitchen_voice, onboarding_complete")
      .eq("id", uid)
      .maybeSingle();
    setProfile(data ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
        maybeFirePortrait(s.user.id);
      } else {
        setProfile(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        maybeFirePortrait(data.session.user.id);
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile: async () => {
          if (session?.user) await loadProfile(session.user.id);
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}