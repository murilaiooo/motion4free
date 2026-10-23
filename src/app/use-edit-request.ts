import { useEffect, useRef } from 'react';

/** A response belongs only to the plan and selection used to start it. Never rebase an AI edit implicitly. */
export function useEditRequest(owner: unknown, detail: string, onInvalidated: () => void) {
  const scope = useRef({ owner, detail });
  scope.current = { owner, detail };
  const active = useRef<{ ctrl: AbortController; owner: unknown; detail: string } | null>(null);
  const notify = useRef(onInvalidated);
  notify.current = onInvalidated;
  const mounted = useRef(true);
  const cancel = () => {
    if (!active.current) return;
    active.current.ctrl.abort();
    active.current = null;
    notify.current();
  };
  useEffect(() => {
    if (active.current && (active.current.owner !== owner || active.current.detail !== detail)) cancel();
  }, [owner, detail]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.ctrl.abort(); active.current = null; };
  }, []);
  return {
    cancel,
    begin: () => {
      active.current?.ctrl.abort();
      const request = { ctrl: new AbortController(), owner, detail };
      active.current = request;
      const current = () => mounted.current && active.current === request && !request.ctrl.signal.aborted && scope.current.owner === owner && scope.current.detail === detail;
      return {
        signal: request.ctrl.signal,
        current,
        finish: () => { if (active.current === request) active.current = null; },
      };
    },
  };
}
