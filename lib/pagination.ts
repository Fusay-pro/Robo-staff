// Pager arithmetic for list pages. Pure, 1-based, no React.
//
// Page numbers here are 1-based because that is what the buttons show; the
// components that call this keep their own 0-based `page` state for the API's
// `offset`, and convert at the call site (`pageWindow(page + 1, totalPages)`).

export const PAGE_SIZE = 50;   // students per page; one page is also one bulk delete

// A slot in the pager: a page number to render as a button, or a collapsed
// run of pages to render as a non-interactive ellipsis.
export type PageSlot = number | 'gap';

// The page index to actually show, given how many pages there turned out to be.
// A list can shrink under the viewer — a delete here, a delete in another tab —
// and the stored index then points past the end. Clamping at render time means
// the view is always a page that exists, with no corrective state update and no
// window where an empty list has nothing to navigate with. 0-based, like the
// `page` state that feeds it.
export function clampPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 0;
  return Math.min(Math.max(page, 0), totalPages - 1);
}

// Offsets that walk a list of `total` rows in `limit`-sized requests. Used to
// pull every row matching the current filters when the page on screen is only
// a slice of them.
export function offsetsFor(total: number, limit: number): number[] {
  if (total < 1 || limit < 1) return [];
  const out: number[] = [];
  for (let offset = 0; offset < total; offset += limit) out.push(offset);
  return out;
}

// Total buttons the pager shows once pages are collapsed: first, gap, three
// around the current page, gap, last. Fixed so the row keeps a steady width
// instead of twitching as you walk through the pages.
const MAX_SLOTS = 7;

// The window of page numbers to show for `current`, with page 1 and the last
// page always present and an ellipsis wherever a run is collapsed.
//
//   pageWindow(1, 12)  -> [1, 2, 3, 4, 5, 'gap', 12]
//   pageWindow(5, 12)  -> [1, 'gap', 4, 5, 6, 'gap', 12]
//   pageWindow(12, 12) -> [1, 'gap', 8, 9, 10, 11, 12]
export function pageWindow(current: number, totalPages: number): PageSlot[] {
  if (totalPages < 1) return [];

  const last = Math.floor(totalPages);
  if (last <= MAX_SLOTS) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  // A page out of range (a stale `page` after a delete, say) shows the window
  // for the nearest real page rather than an empty or lopsided row.
  const page = Math.min(Math.max(Math.floor(current), 1), last);

  if (page <= 4) {
    return [1, 2, 3, 4, 5, 'gap', last];
  }
  if (page >= last - 3) {
    return [1, 'gap', last - 4, last - 3, last - 2, last - 1, last];
  }
  return [1, 'gap', page - 1, page, page + 1, 'gap', last];
}
