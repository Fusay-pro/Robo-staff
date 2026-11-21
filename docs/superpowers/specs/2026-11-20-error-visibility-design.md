# Errors you can see: surfacing failures in the staff app and logging them in the API

Date: 2026-11-20
Size: project (two repos: staff-web + API, one database migration)

## Intent and why

A bulk delete failed repeatedly and silently. The API rejected every batch
over 20 with `400 Too big: expected array to have <=50 items`, the staff app
showed nothing useful, nothing was written, and the roster reappeared on the
next reload. Diagnosing it needed a terminal, PM2, and a database session.

The owner asked for two things: the web should say what the error was,
for everything, and the API should keep a log of those errors. Asked who
reads the log, the answer was "both you and me" — so it has to be readable
inside the app by the owner, and queryable by an engineer afterwards.

## Goals

- No failed request is invisible. Anything that fails — a form submit, a
  background refetch, a list that will not load — tells the user what
  happened, in words taken from the server when the server gave a reason.
- One place that turns an error into a message, instead of 36 hand-rolled
  fallbacks.
- Every API response of status 400 or worse is recorded server-side with
  enough context to explain it later: who, when, what they called, what the
  status was, what the message said, and the stack for a 500.
- The owner can read that log in the staff app without a terminal.
- The log survives an API restart.

## Non-goals

- Replacing inline form errors with toasts. A message next to the field you
  got wrong is better than a corner popup; inline errors stay.
- An alerting or paging system. This is a record to read after the fact.
- Logging successful requests. This is an error log, not an access log.
- Log shipping to an external service.
- Changing what the API tells clients on a 500. Internals stay masked.

## Anti-goals

- A toast storm. One failure must not produce a stack of identical popups,
  and token-refresh 401s must not surface at all — they are routine.
- A log that fills the database. It is on Supabase's free tier.
- A log that leaks a password, a token, or a parent's personal details into
  a table that a future bug could expose.
- An error surface that fails louder than the thing it is reporting: a
  failure to write the log must never turn a working request into a broken one.

## Constraints

- staff-web: Next.js 16 App Router, React 19, @tanstack/react-query v5,
  Tailwind v4, axios with an interceptor that already handles 401 refresh
  (`lib/api.ts`). Every string goes through `t()` and both locales in
  `lib/i18n/messages.ts` (765 keys each, symmetric).
- API: Express 5, Zod via `middleware/validate`, `roleGuard`, a global error
  handler in `src/app.js` that already logs stacks to PM2 and masks 500s.
  Helpers in `src/utils/errors.js` already shape 4xx bodies.
- Migrations are numbered files in `migrations/`; the last is
  `016_students_archived.sql`. `sheets_sync_log` is the precedent for a log
  table.
- The API runs under PM2 on the VM behind ngrok. **A deploy is a restart** —
  `pm2 restart robo-api`. Pushing changes nothing. This is what caused the
  original incident.
- Owner-only means `role === 'owner' || role === 'super_owner'`, enforced on
  the server with `roleGuard`, matching the existing manage tabs.

## Approaches

Two decisions, each with the alternatives considered.

**Where errors appear in the web.** Chosen: a toast host in the app shell,
raised automatically from the axios response interceptor, plus one shared
`errorMessage(e)` helper. Rejected: fixing only the two silent `catch` blocks
— it leaves every future silent failure to be found one at a time, which is
what the owner asked to stop. Rejected: a React error boundary alone — it
catches render crashes, not failed requests, which are the actual problem.
The boundary is still worth having and is included, but as a second layer.

**Where the log lives.** Chosen: a database table, plus an owner-only viewer
as a new tab in the existing Manage page, plus a one-line console entry so
PM2 keeps a copy. Rejected: a file on the VM via pino or winston — fast to
build, but unreadable without a terminal, and the owner is one of the two
readers. Rejected: PM2's existing log alone — it is what we have now, it does
not record 4xx at all, and it is already 679 KB of mixed output.

## The design

### 1. API: record every error response

A middleware wraps `res.json` to notice the status before the response goes
out, so routes keep returning `res.status(400).json({error})` exactly as they
do now — no route changes, and nothing to remember for routes added later.

Recorded for any status >= 400:

| column | holds |
|---|---|
| `log_id` | serial primary key |
| `occurred_at` | timestamptz, default NOW() |
| `status` | int, the HTTP status |
| `method`, `path` | the route as called; `path` is the Express route pattern (`/students/:id`), never the raw URL, so ids stay out of the log |
| `message` | the `error` string the client received |
| `stack` | text, null below 500 |
| `user_id`, `role`, `branch_id` | from the JWT when there is one, else null. No name: the viewer joins `users` |
| `request_id` | short random id, also returned to the client in an `x-request-id` header |

**Never recorded:** request bodies, query strings, headers, tokens. The path
pattern plus the message is enough to explain a failure, and none of it is
personal data.

**Skipped, to keep the log readable:** every 401 raised by the auth
middleware (expired or invalid token — routine churn, see Decisions), 429s
from the rate limiter (already visible as a pattern), and 404s for static or
unmatched paths. A 401 a route raises deliberately is kept. Everything else
is recorded.

**Failure is contained.** The write is fire-and-forget: a logging failure is
caught and reported to the console only. A broken log must never break a
working request.

**A one-line console entry accompanies each row** (`[err] 400 POST
/students/bulk-delete user=12 req=a1b2c3 Too big…`) so PM2 keeps a copy and
`pm2 logs` stays useful.

**Pruning:** rows older than 30 days are deleted, hooked into the cron the
project already runs, so the free-tier database is not asked to grow forever.

### 2. API: read the log back

`GET /admin/logs`, owner-only via `roleGuard(['owner','super_owner'])`,
newest first, paginated the same way the students list is (`limit`, `offset`,
`total`), with optional `status` and `since` filters. A super_owner sees every
branch; an owner sees their own branch's rows and rows with no branch.

### 3. Web: one helper, one toast host

`lib/errorMessage.ts` turns anything thrown by axios into a sentence:

- the server said something → that text (`error` from the body)
- 500 or no body → "Something went wrong on the server"
- no response at all → "Can't reach the server. Check your connection."
- 403 → "You don't have permission to do that"

A `ToastProvider` in the app shell renders a stack of dismissible messages,
bottom-right on desktop, above the bottom bar on mobile, auto-dismissing
after 8 seconds, with identical consecutive messages collapsed into one with
a count. Both errors and successes auto-dismiss, and either can be dismissed
early (see Decisions).

The axios response interceptor raises a toast for every rejected request,
after the existing 401-refresh logic, and skips the refresh path itself.
Where a component already shows an inline error, it keeps doing so — the
toast is what covers the cases nobody wrote a handler for.

Both `catch` blocks that currently swallow errors
(`app/students/page.tsx` export, `HolidayWizardModal`) report through the
helper instead.

### 4. Web: a crash is also an error

A React error boundary around the app shell replaces a blank page with a
readable "Something broke on this page" panel and a reload button. It posts
the error and component stack to `POST /client-errors` — any authenticated
user, own rate limit — which stores it with status 0 and the caller's
identity, so a crash in the browser lands in the same log as a server failure. This is my call, not something the owner
asked for by name: "show what the error is for everything" includes the case
where the page dies.

### 5. Web: the viewer

A new **Logs** tab in `app/manage/page.tsx`, owner-only like the delete
controls, listing newest first: time, status badge (red 5xx, amber 4xx, grey
client), method and path, message, and who it happened to. A row expands to
show the stack and request id. Filters: status class and last 24h / 7d / 30d.
It reuses the students pager (`lib/pagination.ts`).

## Decisions settled after the design was reviewed

A fresh engineer read this document and reported what they would have had to
guess. Three answers came from the owner; the rest are my calls, marked as
such so they can be overruled while reading.

**Owner's answers:**

- **The migration is applied by me**, directly against Supabase using the
  `DATABASE_URL` in the API's `.env`, immediately before the API restart.
  There is no migration runner in the repo and `migrations/*.sql` are
  hand-applied, so the file is still written and committed as
  `017_error_logs.sql` — it is the record of what was run.
- **Logging is switched off when `NODE_ENV=test`.** The jest suite runs
  against the live Supabase database (this is how test fixtures reached real
  data earlier in the week), so without this every test run — including the
  tests that deliberately provoke 4xx — would write rows into the log the
  owner reads. Consequence accepted: the middleware's write path is then
  tested by calling the recorder directly rather than through supertest.
- **English server text is acceptable in a Thai-locale toast.** The app's own
  wrapper sentences are translated; the server's sentence is shown as-is.
  Error codes were considered and rejected as a much larger job across nearly
  every route.

**My calls:**

- **A failed request shows both its inline message and a toast, and error
  toasts auto-dismiss after 8 seconds** rather than persisting. An axios
  interceptor cannot know whether its caller handles the error, and the
  alternative — an opt-out flag threaded through 48 mutation call sites —
  costs more than the mild duplication it saves. Dismissing early stays
  available. A toast and a message by the field are not harmful together; a
  sticky toast after a handled form error would be.
- **Connection failures get one toast, not one per request.** With three
  polling pages (approvals 60s, dashboard 5min, schedule 7min) and
  `retry: 1`, a tunnel outage would otherwise stack popups forever. A
  response-less error raises a single "Can't reach the server" toast that
  replaces itself while the outage lasts.
- **All token-expiry 401s are skipped, not just those on `/auth/refresh`.**
  Access tokens last 15 minutes and clients discover expiry by getting a 401
  on an ordinary route, so the original skip rule would have made "Invalid or
  expired token" the highest-volume row in the table. Any 401 raised by the
  auth middleware is skipped; a 401 a route raises deliberately is kept.
- **Client crash reports go to `POST /client-errors`, not under `/admin`.**
  Mounted for any authenticated user, behind its own rate limit (10 per 15
  minutes per IP), because `/admin` is owner-only and a crash is worth
  recording whoever hit it. Accepted limit: a crash on the login page, or
  with a dead token, is not recorded — an unauthenticated write endpoint is
  an abuse surface I am not willing to add for that case.
- **The log stores `user_id`, `role` and `branch_id`, never a name.** The
  viewer joins `users` for display and falls back to `user #<id>` for rows
  whose user is gone. Copying names into the log would duplicate personal
  data into a second table for no diagnostic gain.
- **The log is API-wide**, including parent-app and mobile traffic, because
  an error log that hides half the API's failures is the problem this work
  exists to fix. The viewer scopes by branch as described and gets no
  app-source filter in this version.

## Left to the builder

- Whether the toast host is hand-rolled or a small library: hand-rolled is
  likely fewer bytes than a dependency, but either is fine if it meets the
  behaviour above.
- The exact migration number (`017_` unless something lands first) and index
  choices; an index on `occurred_at DESC` is the one the viewer needs.
- How the path pattern is obtained in Express 5 (`req.route`/`baseUrl`
  composition), including what to record when no route matched.
- Where the pruning hook attaches among the existing crons.
- How `NODE_ENV=test` suppression is wired so the recorder itself stays
  directly testable.
- Toast placement details that avoid colliding with the existing bottom
  navigation on mobile.
