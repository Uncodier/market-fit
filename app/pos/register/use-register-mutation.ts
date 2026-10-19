"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { RegisterResult } from "./types";
import { requireRegisterOnline } from "./register-ui-utils";

// Keep the same idempotency key when retrying an identical failed request.
export function useRegisterMutation() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const requestIds = useRef(new Map<string, string>());
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function run<T>(key: string, operation: (requestId: string) => Promise<RegisterResult<T>>, onSuccess: (data: T) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        requireRegisterOnline();
        let requestId = requestIds.current.get(key);
        if (!requestId) {
          requestId = crypto.randomUUID();
          requestIds.current.set(key, requestId);
        }
        const result = await operation(requestId);
        if (result.error !== undefined) throw new Error(result.error);
        requestIds.current.delete(key);
        if (mounted.current) onSuccess(result.data);
      } catch (failure) {
        if (mounted.current) setError(failure instanceof Error ? failure.message : "Register request failed. Refresh to verify the register before retrying.");
      } finally {
        inFlight.current = false;
      }
    });
  }
  return { pending, error, run, setError };
}