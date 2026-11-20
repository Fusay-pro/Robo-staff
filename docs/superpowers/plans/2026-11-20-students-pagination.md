# Students List Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the students list's "Load more" accumulation with numbered pages of 50 — first and last page always reachable, a sliding window between them — and raise the bulk-delete cap to a full page.

**Architecture:** The window arithmetic becomes one pure function in `lib/pagination.ts`, unit-tested on its own. `app/students/page.tsx` then renders only the current page's rows (React Query already caches per page key), so the `accumulated` array, its merge effect and the Load-more button are deleted. The API's `BULK_DELETE_MAX` goes 20 → 50 so one page can be cleared in one confirm, and "Select all" becomes page-local, which drops this page's `GET /students/ids` call.

**Tech Stack:** Next.js 16 (App Router, client component), React 19, @tanstack/react-query v5, Tailwind v4 — web. Express 5, Zod, Jest + Supertest — API. Web unit tests run on Node 24's built-in runner (`node --test`), which strips TypeScript types with no new dependency; verified working on this machine.

**Spec:** `docs/superpowers/specs/2026-11-20-students-pagination-design.md`

## Two repositories

| Repo | Path | Tasks |
|------|------|-------|
| staff-web | `/home/postal/projects/robotics-school/R13en0ne/robotics-school-staff-web` | 1, 3 |
| API | `/home/postal/projects/robotics-school/R13en0ne/robotics-school` | 2 |

Task 2 is on the API's current branch `custom-domain-cors-and-cloudflare-tunnel`. Commit in the repo each task names; never cross-commit.

## Global Constraints

- Page size is **50**. Bulk-delete cap is **50** in both repos and the two numbers must stay equal — one page is one delete.
- API `limit` is capped at 200 (`src/routes/students.js:10`); this work must not raise it.
- Every delete control stays owner-only (`role === 'owner' || role === 'super_owner'`), per commit fb3080b. No task may render one for staff.
- Every user-facing string goes through `t()` and must be added to **both** locales in `lib/i18n/messages.ts` (`en` near line 421, `th` near line 1216). `t(key, params)` interpolates `{name}` placeholders.
- Pure functions are 1-based for page numbers; the component's `page` state stays 0-based. Convert at the call site only.
- Pushing does not deploy the API — it runs on the VM behind the tunnel and needs a pull + restart there.

## Review Focus

Input classes the spec implies but no task's main deliverable exercises. Each has its test pinned to the task that owns the code.

1. **Bulk-deleting the whole last page** leaves `page` pointing past the end: the list renders empty with a pager that no longer has that page. The page must clamp to the new last page (Task 3).
2. **`total` of 0** (empty roster, or a search matching nothing): `Math.ceil(0 / 50)` is 0 pages, so the pager must be absent rather than render a zero-width window (Tasks 1 and 3).
3. **Typing in search while on page 4**: offset must reset to 0, or the user sees an empty page of a short result set (Task 3).
4. **Changing page with ticks already made**: the selection must clear, or the confirm modal deletes students the owner can no longer see and whose names it cannot show (Task 3).
5. **Ids already soft-deleted, or outside the caller's branch, inside a 50-id batch**: the API must report them as `skipped` rather than counting them deleted (Task 2).

---

### Task 1: Pager window arithmetic

**Files:**
- Create: `lib/pagination.ts`
- Test: `lib/pagination.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const PAGE_SIZE = 50`, `export type PageSlot = number | 'gap'`, and
  `export function pageWindow(current: number, totalPages: number): PageSlot[]`.
  1-based. Always returns exactly `MAX_SLOTS` (7) entries when
  `totalPages > 7`, every page number when `totalPages` is 1–7, and `[]`
  when `totalPages < 1`.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow } from './pagination.ts';

test('no gaps when every page fits', () => {
  assert.deepEqual(pageWindow(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(1, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('near the start: first five, gap, last', () => {
  assert.deepEqual(pageWindow(1, 12), [1, 2, 3, 4, 5, 'gap', 12]);
  assert.deepEqual(pageWindow(4, 12), [1, 2, 3, 4, 5, 'gap', 12]);
});

test('in the middle: first, gap, neighbours, gap, last', () => {
  assert.deepEqual(pageWindow(5, 12), [1, 'gap', 4, 5, 6, 'gap', 12]);
  assert.deepEqual(pageWindow(8, 12), [1, 'gap', 7, 8, 9, 'gap', 12]);
});

test('near the end: first, gap, last five', () => {
  assert.deepEqual(pageWindow(9, 12), [1, 'gap', 8, 9, 10, 11, 12]);
  assert.deepEqual(pageWindow(12, 12), [1, 'gap', 8, 9, 10, 11, 12]);
});

test('width stays steady at seven slots', () => {
  for (const c of [1, 2, 5, 7, 8, 11, 12]) {
    assert.equal(pageWindow(c, 12).length, 7, `current=${c}`);
  }
});

test('degenerate totals', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 0), []);
  assert.deepEqual(pageWindow(1, -3), []);
});

test('current outside the range is clamped, not trusted', () => {
  assert.deepEqual(pageWindow(99, 12), [1, 'gap', 8, 9, 10, 11, 12]);
  assert.deepEqual(pageWindow(0, 12), [1, 2, 3, 4, 5, 'gap', 12]);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd <staff-web> && node --test lib/pagination.test.ts`
Expected: FAIL — cannot find module `./pagination.ts`.

- [ ] **Step 3: Implement `pageWindow` in `lib/pagination.ts`**

Export `PAGE_SIZE = 50` from this file too; Task 3 imports it so the page
size lives in one place. Clamp `current` into `[1, totalPages]` first. Three
branches, each producing 7 slots: `current <= 4` → `1..5, 'gap', last`;
`current >= totalPages - 3` → `1, 'gap', last-4..last`; otherwise
`1, 'gap', current-1, current, current+1, 'gap', last`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test lib/pagination.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit** (staff-web)

```bash
git add lib/pagination.ts lib/pagination.test.ts
git commit -m "Add pageWindow(): sliding page numbers with first and last pinned"
```

---

### Task 2: Raise the API's bulk-delete cap to 50

**Files:**
- Modify: `src/routes/students.js:11` (`BULK_DELETE_MAX`)
- Test: `tests/students.bulkdelete.test.js` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `POST /students/bulk-delete` accepts up to 50 ids and still
  answers `{deleted, skipped}`. Response shape is unchanged.

Model the test file on `tests/schedules.bulk.test.js`: `createApp()` from
`../src/app`, a `jwt.sign` owner token, fixtures seeded in `beforeAll` and
removed in `afterAll`. Seed 51 students in one branch, plus one student in a
second branch and one already soft-deleted (`deleted_at = NOW()`), for the
skip assertions.

Unlike the schedules tests, the token's `user_id` cannot be a made-up number:
the route reads `password_hash` from `users` for that id and answers 403 when
it finds none (`src/routes/students.js:447-453`). Seed a real owner row with
`bcrypt.hash(OWNER_PASSWORD, 10)` and sign the token with its `user_id`.

- [ ] **Step 1: Write the failing tests**

```js
test('accepts a full page of 50 ids', async () => {
  const res = await request(app)
    .post('/students/bulk-delete')
    .set(bearer(ownerToken(branchMain)))
    .send({ password: OWNER_PASSWORD, student_ids: fiftyIds });
  expect(res.status).toBe(200);
  expect(res.body.deleted).toBe(50);
  expect(res.body.skipped).toBe(0);
});

test('rejects 51 ids', async () => {
  const res = await request(app)
    .post('/students/bulk-delete')
    .set(bearer(ownerToken(branchMain)))
    .send({ password: OWNER_PASSWORD, student_ids: fiftyOneIds });
  expect(res.status).toBe(400);
});

// Review Focus 5
test('counts already-deleted and other-branch ids as skipped', async () => {
  const res = await request(app)
    .post('/students/bulk-delete')
    .set(bearer(ownerToken(branchMain)))
    .send({ password: OWNER_PASSWORD, student_ids: [liveId, alreadyDeletedId, otherBranchId] });
  expect(res.status).toBe(200);
  expect(res.body.deleted).toBe(1);
  expect(res.body.skipped).toBe(2);
});
```

- [ ] **Step 2: Run them to see the cap reject 50**

Run: `cd <api> && npx jest tests/students.bulkdelete.test.js --runInBand`
Expected: the 50-id test FAILS with 400 (Zod `max(20)`); the 51-id and skip
tests pass.

- [ ] **Step 3: Set `BULK_DELETE_MAX = 50` in `src/routes/students.js:11`**

Keep the trailing comment's intent — it explains why a cap exists at all —
and update it to say the cap matches one page of the staff list.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx jest tests/students.bulkdelete.test.js --runInBand`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the whole suite for regressions**

Run: `npm test`
Expected: no new failures against the existing enrollment and schedule tests.

- [ ] **Step 6: Commit** (API, branch `custom-domain-cors-and-cloudflare-tunnel`)

```bash
git add src/routes/students.js tests/students.bulkdelete.test.js
git commit -m "Bulk student delete: raise the cap to 50 (one page of the staff list)"
```

---

### Task 3: Numbered pages on the students list

**Files:**
- Modify: `app/students/page.tsx`
- Modify: `lib/i18n/messages.ts` (both locales)

**Interfaces:**
- Consumes: `pageWindow`, `PageSlot`, `PAGE_SIZE` from `lib/pagination.ts` (Task 1); the 50-id cap from Task 2.
- Produces: nothing other modules import.

- [ ] **Step 1: Delete the accumulation machinery**

Remove `accumulated` state, the merge `useEffect` (`page.tsx:66-78`), the
`displayList` fallback (`page.tsx:80-82`), `hasMore`, the local `PAGE_SIZE`
const (now imported), and the Load-more block (`page.tsx:372-383`). Render
`pageData?.data ?? []` as the list. Drop `setAccumulated` from the two reset
effects and from `onDeleted`. Keep the `['students-list', …, page]` query key
as it is — it is what makes a revisited page instant.

- [ ] **Step 2: Add the pager below the grid**

`const totalPages = Math.ceil(total / PAGE_SIZE)`. Render nothing when
`totalPages <= 1` (Review Focus 2). Otherwise a centred row: a Prev arrow
disabled on page 0, `pageWindow(page + 1, totalPages)` mapped to buttons —
a number sets `setPage(n - 1)` and shows the current page in the active
style (`bg-primary text-white`, matching the status filter chips at
`page.tsx:221-223`), a `'gap'` renders a non-interactive `…` — then a Next
arrow disabled on the last page. Mark the active button `aria-current="page"`.
Use the existing arrow glyphs style: `material-symbols-outlined` with
`chevron_left` / `chevron_right`. Show `students.pageOf` beneath on small
screens.

- [ ] **Step 3: Clamp, reset and scroll on page change**

- Review Focus 1: when `totalPages > 0 && page > totalPages - 1`, call
  `setPage(totalPages - 1)` in an effect keyed on `totalPages`, so deleting
  the last page lands on the new final page instead of an empty one.
- Review Focus 4: clear the selection whenever `page` changes — one effect
  keyed on `page` calling `setSelected(new Set())`. Leave `selectMode` on.
- Review Focus 3 is already handled by the two existing reset effects
  (`page.tsx:40-45`); keep both, minus their `setAccumulated` calls.
- Scroll the list back to the top on a page change: a `ref` on the grid
  wrapper and `scrollIntoView({ block: 'start' })` in the same effect, guarded
  so it does not fire on first mount.

- [ ] **Step 4: Make "Select all" page-local and lift the cap to 50**

Set `MAX_BULK_DELETE = 50`. Replace `selectAllMatching` with a synchronous
handler that ticks the current page's `student_id`s; delete `selectingAll`
state, the `/students/ids` call, `filterQuery` if nothing else uses it, and
the `students.selectAllFailed` usage. The bar's count reads
`{selected.size} / {rows.length}` and its button label shows `rows.length`.

- [ ] **Step 5: Update both locales in `lib/i18n/messages.ts`**

- `students.selectMax` currently hardcodes 20 in English and Thai. Make it
  `'Up to {n} students can be deleted at a time.'` /
  `'ลบได้สูงสุด {n} รายชื่อต่อครั้ง'` and call
  `t('students.selectMax', { n: MAX_BULK_DELETE })`.
- Add `students.pageOf`: `'Page {page} of {total}'` /
  `'หน้า {page} จาก {total}'`.
- Add `students.prevPage` / `students.nextPage` (`'Previous'` / `'Next'`,
  `'ก่อนหน้า'` / `'ถัดไป'`) for the arrows' `aria-label`s.
- Leave `students.loadMore` and `students.remaining` in place only if another
  page uses them; grep first and delete from both locales if not.

- [ ] **Step 6: Verify the build and types**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: no errors. A leftover reference to `accumulated`, `hasMore` or the
removed local `PAGE_SIZE` fails here.

- [ ] **Step 7: Verify in the running app**

Run the app against the API and check, as owner: page numbers appear only
past 50 students; clicking 3 shows `1 … 2 [3] 4 … n`; going back to a visited
page does not re-fetch; the list jumps to the top on a page change; ticking
rows then changing page clears the ticks; "Select all" takes the 50 on
screen and the confirm modal deletes them in one go. Then as staff: no
Select button, no delete controls.

- [ ] **Step 8: Commit** (staff-web)

```bash
git add app/students/page.tsx lib/i18n/messages.ts
git commit -m "Students list: numbered pages of 50 instead of Load more"
```
