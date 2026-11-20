# Students list: numbered pages instead of "Load more"

Date: 2026-11-20
Size: small change (two repos: staff-web + API)

## Intent and why

The students list currently grows by appending 50-row rounds onto one long
list. The owner wanted it to behave like pages: click a number, see that
page, and load only that page. Nothing in the current list lets you jump —
reaching the end of a long roster means clicking "Load more" repeatedly, and
the rendered list keeps everything above it.

## Goals

- 50 students per page, numbered page buttons, sliding window of numbers,
  with the first and last page always reachable in one click.
- Only the viewed page is fetched. Revisiting a page is instant (React Query
  already caches per `['students-list', search, status, page]` key).
- A whole page can be bulk-deleted in one confirm.

## Non-goals

- Raising the API's `LIMIT_MAX` of 200. Owner explicitly rejected bigger
  pages ("more will make the scale too high").
- Loading the whole roster at once.
- Infinite scroll.
- Carrying a selection across pages.

## Anti-goals

- A pager that can't reach the first or last page in one click.
- Selection silently surviving a page change, so a confirm modal deletes
  students the owner can no longer see.

## Constraints

- API: `GET /students?limit&offset` returns `{data, total, limit, offset}`,
  `limit` capped at 200 (`students.js:10`).
- `POST /students/bulk-delete` is owner-only, password-confirmed, soft
  deletes, and rejects more than `BULK_DELETE_MAX` ids (`students.js:11`).
- Delete controls stay owner-only; staff must not see them (commit fb3080b).
- Backend runs on the VM behind the tunnel — it needs a pull + restart there,
  pushing does not deploy it.

## Approaches

1. **One fetch of 200, search/filter past that.** Simplest, least code, but
   gives no way to jump and silently hides students past 200. Rejected.
2. **200-row fetch plus page buttons only past 200.** Keeps pager machinery
   for a case that may never fire; still renders 200 rows at once. Rejected.
3. **Numbered pages of 50, sliding window — chosen.** What the owner asked
   for: "when you click 2 it show 1234 ... and when it hit 3 it 2345, and
   load those". Never more than 50 rows rendered, any page reachable.

## The design

**Pager.** 50 per page. Prev / Next arrows, **page 1 and the last page
always shown**, a sliding window of page numbers around the current page,
and an ellipsis on whichever side is collapsed. Current page is visually
active. Arrows disable at the ends. The pager is hidden entirely when
`total <= 50`.

```
page 1 of 12:   ‹  [1] 2  3  4  …  12  ›
page 5 of 12:   ‹   1 … 4 [5] 6 … 12  ›
page 12 of 12:  ‹   1 …  9 10 11 [12]  ›
```

**Loading.** The existing query already keys on `page`; the page simply
renders `pageData.data`. Deleted: `accumulated`, the merge `useEffect`, the
dedupe-by-id, the `displayList` fallback, `hasMore`, and the Load-more
button. Changing search or status filter resets to page 0 (already does).
Changing page scrolls the list back to the top.

**Selection.** Clears on every page change, on search change, and on status
change. Owner's call: carrying it across pages is "too hassle".

**Bulk delete cap 20 -> 50**, so one page can be cleared in one confirm:
`BULK_DELETE_MAX` in the API and `MAX_BULK_DELETE` in the page. The modal's
name preview still shows the first 8 plus a "+N more" line.

**"Select all" becomes page-local.** Because selection no longer spans
pages, it ticks the 50 rows on screen instead of fetching every matching id.
The `GET /students/ids` call leaves this page; the endpoint itself stays in
the API, unused by the list.

## Left to the builder

- Exact window arithmetic at the edges, so the row of buttons keeps a
  steady width instead of shrinking on the first and last pages.
- Reusing existing i18n keys where they fit; new keys for the pager.
- Where the scroll-to-top anchor lives in the existing markup.
