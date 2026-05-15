import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = {
  suppressed: boolean;
  setSuppressed: (v: boolean) => void;
};

const ChatSuppressionCtx = createContext<Ctx | null>(null);

export function ChatSuppressionProvider({ children }: { children: ReactNode }) {
  const [suppressed, setSuppressed] = useState(false);
  return (
    <ChatSuppressionCtx.Provider value={{ suppressed, setSuppressed }}>
      {children}
    </ChatSuppressionCtx.Provider>
  );
}

export function useChatSuppression() {
  const v = useContext(ChatSuppressionCtx);
  if (!v) {
    // Safe no-op fallback when used outside provider (e.g. SSR)
    return { suppressed: false, setSuppressed: () => {} };
  }
  return v;
}

/** Convenience hook: suppress chat while the calling component is mounted. */
export function useSuppressChatWhileMounted() {
  const { setSuppressed } = useChatSuppression();
  useEffect(() => {
    setSuppressed(true);
    return () => setSuppressed(false);
  }, [setSuppressed]);
}
