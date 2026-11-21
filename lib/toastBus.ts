// A one-line bridge from the axios interceptor to the toast host.
//
// The interceptor lives in a module, not in the React tree, so it cannot reach
// a context. It publishes here and the host subscribes. The payload carries a
// classified error rather than a finished sentence, because the wording is
// translated and only the host has `t`.

import type { ErrorKind } from './errors';

export type ToastRequest =
  | { tone: 'error'; error: ErrorKind }
  | { tone: 'error'; text: string }
  | { tone: 'success'; text: string };

type Listener = (request: ToastRequest) => void;

const listeners = new Set<Listener>();

export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Never throws into a caller: a failure to show a message must not replace the
// failure being reported. With no host mounted — the login page, a render
// before hydration — the request is simply dropped.
export function emitToast(request: ToastRequest): void {
  for (const listener of listeners) {
    try {
      listener(request);
    } catch {
      // ignored on purpose
    }
  }
}
