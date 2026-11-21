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
