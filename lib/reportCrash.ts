// Sends a crash in the browser to the same error log as a server failure, so
// "show me what the error was" covers the case where the page itself dies.
//
// POST /client-errors stores it with status 0 and the caller's identity. A
// crash on the login page, or with a dead token, is not recorded — that would
// need an unauthenticated write endpoint, which is not worth adding for it.

import client from './api';

// React can render an error boundary more than once for one crash, and a
// retry that fails again arrives as the same error. One row per distinct
// crash per page load is enough.
const reported = new Set<string>();

export function reportCrash(error: unknown, extra?: { digest?: string }): void {
  if (typeof window === 'undefined') return;

  const err = error instanceof Error ? error : new Error(String(error));
  const key = `${err.message}|${extra?.digest ?? ''}`;
  if (reported.has(key)) return;
  reported.add(key);

  const message = extra?.digest ? `${err.message} [digest ${extra.digest}]` : err.message;

  client
    .post('/client-errors', {
      message,
      stack: err.stack ?? undefined,
      // The server replaces ids in this with :id before storing it.
      path: window.location.pathname,
    })
    .catch(() => {
      // Nothing to do: the page has already crashed, and a failed report must
      // not make that worse. The console still has the original error.
    });
}
