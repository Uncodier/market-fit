"use client";

import { useRef, useState } from "react";

/** UI admission belongs to one cart, not to unrelated customers or sites. */
export function usePosSubmission(key: string, session: () => string) {
  const current = useRef<{ key: string; session: string } | null>(null);
  const [active, setActive] = useState<{ key: string; session: string } | null>(null);
  const busy = () => current.current?.key === key && current.current.session === session();
  return {
    busy,
    loading: active?.key === key && active.session === session(),
    begin() {
      const token = { key, session: session() };
      current.current = token;
      setActive(token);
      return () => {
        // An old completion cannot unlock a newer customer's submission.
        if (current.current !== token) return;
        current.current = null;
        setActive(null);
      };
    },
  };
}