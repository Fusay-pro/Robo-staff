// One place that turns a failed request into something a person can read.
//
// Every caller used to hand-roll `e?.response?.data?.error || t('…')`, which is
// fine until the body is not what that chain assumes — no `response` at all on
// a network failure, an HTML error page from a proxy, or an `error` field that
// is an object. Then the expression yields `undefined` or a value React cannot
// render, and the screen says nothing at all. The API shapes its 4xx/5xx
// bodies as `{ error: string }` (`src/utils/errors.js`), so that is what we
// read, and anything else falls back to the caller's translated message.

export function errorMessage(e: unknown, fallback: string): string {
  const reason = apiReason(e);
  return reason ?? fallback;
}

// The `error` string the API sent, or null when there is nothing readable.
function apiReason(e: unknown): string | null {
  if (typeof e === 'string') return nonEmpty(e);
  if (!e || typeof e !== 'object') return null;

  const data = (e as { response?: { data?: unknown } }).response?.data;
  if (!data || typeof data !== 'object') return null;

  const field = (data as { error?: unknown }).error;
  return typeof field === 'string' ? nonEmpty(field) : null;
}

function nonEmpty(s: string): string | null {
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// The HTTP status, when the request got a response at all. `undefined` means
// it never reached the API — a dead tunnel, a dropped connection, CORS.
export function errorStatus(e: unknown): number | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const status = (e as { response?: { status?: unknown } }).response?.status;
  return typeof status === 'number' ? status : undefined;
}

// What kind of failure this was. Kept separate from the wording so this module
// stays free of i18n: the toast host has `t` and turns a kind into a sentence,
// and the classification can be tested without one.
export type ErrorKind =
  | { kind: 'reason'; text: string }   // the API explained itself — always preferred
  | { kind: 'offline' }                // never reached the API at all
  | { kind: 'forbidden' }              // refused, with nothing said
  | { kind: 'server' };                // 5xx, or a body we cannot read

export function errorKind(e: unknown): ErrorKind {
  const reason = apiReason(e);
  if (reason) return { kind: 'reason', text: reason };
  // No `response` means the request never arrived: a dead tunnel reads very
  // differently from a server that answered badly, and saying "server error"
  // for it sends people looking in the wrong place.
  if (errorStatus(e) === undefined) return { kind: 'offline' };
  if (errorStatus(e) === 403) return { kind: 'forbidden' };
  return { kind: 'server' };
}

// One sentence for a kind already classified — what the toast host renders,
// since it receives kinds from the interceptor rather than raw errors.
export function describeKind(kind: ErrorKind, t: (key: string) => string): string {
  switch (kind.kind) {
    case 'reason':    return kind.text;
    case 'offline':   return t('errors.offline');
    case 'forbidden': return t('errors.forbidden');
    default:          return t('errors.server');
  }
}

// One sentence for any failure. `t` is the translator from I18nContext.
export function describeError(e: unknown, t: (key: string) => string): string {
  return describeKind(errorKind(e), t);
}

// Whether a failed request should raise a toast.
//
// 401s never do: access tokens last 15 minutes and every client discovers
// expiry by getting one on an ordinary route, which the response interceptor
// answers by refreshing. A toast there would fire several times an hour and
// say nothing useful. The refresh call itself is skipped for the same reason,
// and a request the app cancelled is not a failure at all.
export function shouldToast(e: unknown): boolean {
  if (errorStatus(e) === 401) return false;
  if (!e || typeof e !== 'object') return true;
  const code = (e as { code?: unknown }).code;
  if (code === 'ERR_CANCELED') return false;
  const url = (e as { config?: { url?: unknown } }).config?.url;
  if (typeof url === 'string' && url.includes('/auth/')) return false;
  return true;
}
