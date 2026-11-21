'use client';

import AppShell from '@/components/AppShell';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import client from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { PAGE_SIZE, pageWindow, clampPage, offsetsFor } from '@/lib/pagination';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import AddStudentModal from './_components/AddStudentModal';
import BulkDeleteStudentsModal from './_components/BulkDeleteStudentsModal';

// How many students one delete may carry when the server has not said. The two
// caps live in different repositories, so a server running code older than this
// UI would reject a bigger batch outright — nothing deleted, and the roster back
// on the next reload. 20 was the cap before it followed the page size, so it is
// the value any server still out there is known to accept.
const FALLBACK_BULK_DELETE = 20;

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function StudentsPage() {
  const { t } = useT();
  const { role } = useAuth();
  const isOwner = role === 'owner' || role === 'super_owner';
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'archived'>('all');
  const [page, setPage] = useState(0);   // 0-based; the pager's buttons are 1-based
  const listTop = useRef<HTMLDivElement>(null);

  // Bulk selection (owner only): cards stop navigating and become checkboxes
  const [selectMode, setSelectMode]   = useState(false);
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  // The confirm dialog owns the ids and names it was opened with. While they
  // were derived from live state, anything that touched the selection behind
  // the dialog unmounted it mid-password — including the browser's password
  // manager autofilling the search box, which cleared the selection and
  // filtered the roster down to nothing in the same keystroke.
  const [bulkTarget, setBulkTarget]   = useState<{ ids: number[]; names: string[] } | null>(null);
  const [notice, setNotice]           = useState('');
  const [exporting, setExporting]     = useState(false);
  // The search box starts read-only. Chrome and Arc fill a saved email into
  // the only text input on a page they hold a login for, whatever
  // autoComplete says, and the roster then filters down to nothing and reads
  // as "no students found" — with the delete that just ran looking like the
  // cause. A read-only input is not an autofill candidate; one focus makes it
  // editable, which is how a search box gets used anyway.
  const [searchReady, setSearchReady] = useState(false);

  useEffect(() => {
    const tm = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => clearTimeout(tm);
  }, [search]);

  useEffect(() => { setPage(0); }, [statusFilter]);

  const { data: statsData } = useQuery<any>({
    queryKey: ['students-stats'],
    queryFn: () => client.get('/students/stats').then(r => r.data),
    staleTime: 60_000,
    enabled: !bulkTarget,
  });

  const approvalParam =
    statusFilter === 'archived' ? '&archived=true'
    : statusFilter === 'all'    ? ''
    : `&approval_status=${statusFilter}`;
  const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';

  const listQuery = (p: number) =>
    `/students?limit=${PAGE_SIZE}&offset=${p * PAGE_SIZE}${approvalParam}${searchParam}`;

  // `isError` is read, not ignored: a request that failed is not a roster with
  // no students in it. Without this the list answered a dead tunnel, an expired
  // session or a 500 with "No students found", which reads as every student
  // having been deleted — and a delete is exactly when it was asked to refetch.
  const { data: pageData, isLoading, isFetching, isError, error, refetch } =
    useQuery<{ data: any[]; total: number; bulkDeleteMax: number }>({
      queryKey: ['students-list', debouncedSearch, statusFilter, page],
      // Keep the roster steady while the user enters their password. Closing
      // the confirmation resumes refreshes, including deletion invalidations.
      enabled: !bulkTarget,
      queryFn: async () => {
        const first = await client.get(listQuery(page));
        const total = first.data?.total ?? 0;
        // The list says what this server will accept in one delete.
        const bulkDeleteMax = first.data?.bulk_delete_max ?? FALLBACK_BULK_DELETE;
        const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0);
        // An index past the end of a roster that shrank — a delete here, a
        // delete in another tab — answers with an empty slice, and with one
        // page left the pager is not rendered to climb back with. Serve the
        // last page that exists instead, so the cards are never empty while
        // students exist. `shownPage` clamps to the same index from `total`.
        if (page > lastPage) {
          const corrected = await client.get(listQuery(lastPage));
          return { data: corrected.data?.data ?? [], total, bulkDeleteMax };
        }
        return { data: first.data?.data ?? [], total, bulkDeleteMax };
      },
      // Keep the page you were looking at on screen while the next one loads, so
      // the cards are not replaced by skeletons and the pager stays mounted.
      placeholderData: keepPreviousData,
    });

  // Only the page being viewed is rendered. React Query keeps each page under
  // its own key, so stepping back to a page already seen is served from cache.
  const displayList = pageData?.data ?? [];
  const total       = pageData?.total ?? 0;
  // Never offer a batch this server would reject.
  const maxBulkDelete = pageData?.bulkDeleteMax ?? FALLBACK_BULK_DELETE;
  const totalPages  = Math.ceil(total / PAGE_SIZE);

  // `page` is what was asked for; `shownPage` is the page that exists. A roster
  // that shrank under the viewer — someone else's delete in another tab —
  // leaves the stored index past the end, and the pager would otherwise
  // highlight a page that is not there and read "Page 7 of 2".
  //
  // This is derived from `page`, NOT from the page the query reports serving.
  // Reading it out of the response made it lag one fetch behind while
  // `keepPreviousData` held the previous page on screen, and the arrows step
  // from it: clicking page 10 and then the next arrow mid-flight abandoned the
  // request and landed on page 4, and a second click on next re-set `page` to
  // the value it already held, so React bailed out and the click vanished.
  const shownPage = clampPage(page, totalPages);

  // Ticks never travel between pages: the confirm modal can only name the
  // students on screen, so carrying a selection would delete invisible rows.
  // Skips the first render so a fresh list is not scrolled or cleared.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setSelected(new Set());
    listTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [shownPage]);

  function toggleSelected(id: number) {
    if (!selected.has(id) && selected.size >= maxBulkDelete) {
      setNotice(t('students.selectMax', { n: maxBulkDelete }));
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  const CSV_COLUMNS = [
    { key: 'name',                label: 'Name' },
    { key: 'nickname',            label: 'Nickname' },
    { key: 'age',                 label: 'Age' },
    { key: 'approval_status',     label: 'Status' },
    { key: 'classes_remaining',   label: 'Classes Left' },
    { key: 'active_package_name', label: 'Package' },
    { key: 'parent_name',         label: 'Parent' },
    { key: 'parent_phone',        label: 'Phone' },
  ];

  // The export covers every student matching the current filters, not the page
  // on screen — the list is paged now, so exporting `displayList` would quietly
  // hand back 50 rows out of a longer roster. The API caps a request at 200, so
  // the rows are collected in 200-row requests.
  const EXPORT_LIMIT = 200;
  async function exportAllMatching() {
    setExporting(true);
    try {
      const first = await client.get(`/students?limit=${EXPORT_LIMIT}&offset=0${approvalParam}${searchParam}`);
      const rows  = [...(first.data?.data ?? [])];
      const count = first.data?.total ?? rows.length;
      for (const offset of offsetsFor(count, EXPORT_LIMIT).slice(1)) {
        const next = await client.get(`/students?limit=${EXPORT_LIMIT}&offset=${offset}${approvalParam}${searchParam}`);
        rows.push(...(next.data?.data ?? []));
      }
      downloadCsv('students', rows, CSV_COLUMNS);
      setNotice('');
    } catch (e) {
      // Say why, not just that it failed: the helper prefers the server's own
      // sentence and falls back to this one.
      setNotice(errorMessage(e, t('students.exportFailed')));
    } finally {
      setExporting(false);
    }
  }

  // One page is one delete, so "select all" means the rows on screen. A longer
  // roster is cleared a page at a time.
  function selectAllOnPage() {
    const ids = displayList.map((s: any) => s.student_id).slice(0, maxBulkDelete);
    setSelected(new Set<number>(ids));
    setNotice(displayList.length > maxBulkDelete ? t('students.selectMax', { n: maxBulkDelete }) : '');
  }

  const nameById = new Map<number, string>(displayList.map(s => [s.student_id, s.nickname || s.name]));
  // Only ids still on this page can be deleted: the confirm modal names the
  // students it is about, and a refetch between ticking and confirming (a
  // window focus, a colleague adding students) can move rows off the page.
  // Anything that has drifted away is dropped rather than deleted unseen.
  const selectedIds  = [...selected].filter(id => nameById.has(id));
  const previewNames = selectedIds.map(id => nameById.get(id)) as string[];

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold text-on-surface">{t('students.title')}</h2>
            <p className="text-on-surface-variant mt-1 text-sm">{t('students.subtitle2')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <button onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span className="hidden sm:inline">{t('students.addStudentTitle')}</span>
              </button>
            )}
            {isOwner && (
              <button onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border ${
                  selectMode
                    ? 'bg-error/10 border-error/40 text-error'
                    : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container hover:border-primary/40'
                }`}>
                <span className="material-symbols-outlined text-[18px]">{selectMode ? 'close' : 'checklist'}</span>
                <span className="hidden sm:inline">{selectMode ? t('common.cancel') : t('students.selectLabel')}</span>
              </button>
            )}
          <button onClick={exportAllMatching}
          disabled={total === 0 || exporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container hover:border-primary/40 transition-colors disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="hidden sm:inline">{exporting ? t('students.loading') : t('common.exportCsv')}</span>
          </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 xl:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-container-lowest rounded-2xl p-3 md:p-5 flex items-center gap-4 shadow-sm border border-outline-variant/30">
            <div className="w-10 h-10 rounded-xl bg-primary/10 hidden md:flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-extrabold text-on-surface">{statsData?.total ?? '—'}</p>
              <p className="text-xs text-on-surface-variant font-medium">{t('students.totalStudents')}</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-3 md:p-5 flex items-center gap-4 shadow-sm border border-outline-variant/30">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 hidden md:flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-emerald-700 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>card_membership</span>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-extrabold text-on-surface">{statsData?.with_active_package ?? '—'}</p>
              <p className="text-xs text-on-surface-variant font-medium">{t('students.activePackagesStat')}</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-3 md:p-5 flex items-center gap-4 shadow-sm border border-outline-variant/30">
            <div className="w-10 h-10 rounded-xl bg-orange-100 hidden md:flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-orange-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-extrabold text-on-surface">{statsData?.low_classes ?? '—'}</p>
              <p className="text-xs text-on-surface-variant font-medium">{t('students.lowOnClasses')}</p>
            </div>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl px-3 py-2.5 border border-outline-variant/40 shadow-sm flex-1 min-w-52">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
            {/* Not a login field. Without the attributes below, the browser's
                password manager fills the saved email in here once the delete
                dialog's password box has been on screen: the list then
                searches for an email, matches nothing, and reports an empty
                roster as "no students found". */}
            <input
              type="search"
              name="student-search"
              autoComplete="off"
              readOnly={!searchReady}
              onFocus={() => setSearchReady(true)}
              onPointerDown={() => setSearchReady(true)}
              autoCorrect="off"
              spellCheck={false}
              aria-label={t('students.searchByName')}
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(new Set()); }}
              placeholder={t('students.searchByName')}
              className="bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant flex-1 [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button onClick={() => { setSearch(''); setSelected(new Set()); }} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex gap-1 bg-surface-container-lowest rounded-xl p-1 border border-outline-variant/20">
            {(['all', 'approved', 'pending', 'archived'] as const).map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setSelected(new Set()); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}>
                {t(`students.tab.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
            <span className="material-symbols-outlined text-[18px] text-primary">info</span>
            <p className="text-sm font-semibold text-on-surface flex-1">{notice}</p>
            <button onClick={() => setNotice('')} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* A refetch that failed while rows are still on screen: the cards below
            are the last answer the API gave, so they can be out of date — the
            students just deleted may still be among them. Say so instead of
            letting stale cards pass for fresh ones. */}
        {isError && displayList.length > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-error/30 bg-error-container/20 px-4 py-3">
            <span className="material-symbols-outlined text-[18px] text-error">cloud_off</span>
            <p className="text-sm font-semibold text-on-surface flex-1">
              {t('students.staleList')} {errorMessage(error, t('students.loadFailedHint'))}
            </p>
            <button onClick={() => refetch()} disabled={isFetching}
              className="px-3 py-1.5 rounded-xl bg-error text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Bulk selection action bar */}
        {selectMode && (
          <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-error/30 bg-surface-container-lowest/95 backdrop-blur px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-on-surface mr-auto">
              {selected.size} / {Math.min(displayList.length, maxBulkDelete)} {t('students.selectedCount')}
            </p>
            <button onClick={selectAllOnPage} disabled={displayList.length === 0}
              className="px-3.5 py-2 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50">
              {`${t('students.selectAll')} (${Math.min(displayList.length, maxBulkDelete)})`}
            </button>
            <button onClick={() => setSelected(new Set())} disabled={selected.size === 0}
              className="px-3.5 py-2 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50">
              {t('students.clearSelection')}
            </button>
            <button onClick={() => setBulkTarget({ ids: selectedIds, names: previewNames })}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-error text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
              <span className="material-symbols-outlined text-[16px]">delete</span>
              {t('students.deleteSelected')}
            </button>
          </div>
        )}

        {/* Cards grid. The pager sits outside this block: an empty page still
            needs something to navigate away with. */}
        <div ref={listTop} className="scroll-mt-4" />
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 bg-surface-container-low animate-pulse rounded-2xl" />)}
          </div>
        ) : isError && displayList.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-error block mb-3">cloud_off</span>
            <p className="font-semibold text-on-surface mb-1">{t('students.loadFailed')}</p>
            <p className="text-sm text-on-surface-variant mb-5 max-w-md mx-auto">
              {errorMessage(error, t('students.loadFailedHint'))}
            </p>
            <button onClick={() => refetch()} disabled={isFetching}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              {isFetching ? t('students.loading') : t('common.retry')}
            </button>
          </div>
        ) : displayList.length === 0 ? (
          <div className="py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-outline block mb-3">person_search</span>
            {/* An empty roster and a roster hidden behind a search read the
                same on screen, which is how a search box the browser filled by
                itself passed for "every student is gone". Name the term that
                is filtering, and offer one click out of it. */}
            {debouncedSearch ? (
              <>
                <p className="font-semibold text-on-surface-variant">
                  {t('students.noMatch', { q: debouncedSearch })}
                </p>
                <button onClick={() => { setSearch(''); setSelected(new Set()); }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                  {t('students.clearSearchCta')}
                </button>
              </>
            ) : (
              <p className="font-semibold text-on-surface-variant">{t('students.noFound')}</p>
            )}
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              {displayList.map((s: any) => {
                const isApproved = s.approval_status === 'approved';
                const isPending  = s.approval_status === 'pending';
                const classesLeft = s.classes_remaining ?? 0;
                const barPct = Math.min((classesLeft / 10) * 100, 100);
                const isLow = classesLeft > 0 && classesLeft <= 2;
                const checked = selected.has(s.student_id);
                const cardClass = `group bg-surface-container-lowest rounded-2xl p-5 border shadow-sm transition-all flex gap-4 ${
                  checked ? 'border-error/60 ring-2 ring-error/20' : 'border-outline-variant/30 hover:border-primary/40'
                } ${selectMode ? 'cursor-pointer' : 'hover:-translate-y-0.5 hover:shadow-md'}`;

                const body = (
                  <>
                    {selectMode && (
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 self-start mt-1 transition-colors ${
                        checked ? 'bg-error border-error' : 'border-outline-variant bg-surface'
                      }`}>
                        {checked && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
                      </div>
                    )}
                    <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-md shadow-primary/20">
                      {(s.nickname || s.name) ? initials(s.nickname || s.name) : '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-on-surface text-base group-hover:text-primary transition-colors leading-tight">{s.nickname || s.name}</p>
                            {s.student_code && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s.student_code}</span>
                            )}
                          </div>
                          {s.nickname && (
                            <p className="text-xs text-on-surface-variant mt-0.5 truncate">{s.name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {s.age && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                                {t('approvals.ageLabel')} {s.age}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isApproved ? 'bg-emerald-100 text-emerald-700'
                              : isPending ? 'bg-orange-100 text-orange-700'
                              : 'bg-error/10 text-error'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-500' : isPending ? 'bg-orange-400' : 'bg-error'}`} />
                              {isApproved ? t('students.status.approved') : isPending ? t('students.status.pending') : t('students.status.rejected')}
                            </span>
                          </div>
                        </div>
                        {!selectMode && (
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary transition-colors shrink-0">chevron_right</span>
                        )}
                      </div>

                      <div className="bg-surface-container rounded-xl px-4 py-2.5 mt-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">{t('students.classesLeftLabel')}</p>
                          <p className={`text-2xl font-extrabold leading-none ${isLow ? 'text-error' : 'text-on-surface'}`}>{classesLeft}</p>
                        </div>
                        <div className="flex-1 max-w-[140px]">
                          <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isLow ? 'bg-error' : 'bg-primary'}`}
                              style={{ width: `${barPct}%` }} />
                          </div>
                          {classesLeft === 0 && (
                            <p className="text-[10px] text-error font-semibold mt-1">{t('students.needsRenewal')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );

                return selectMode ? (
                  <div key={s.student_id} role="checkbox" aria-checked={checked} tabIndex={0}
                    onClick={() => toggleSelected(s.student_id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelected(s.student_id); }
                    }}
                    className={cardClass}>
                    {body}
                  </div>
                ) : (
                  <Link key={s.student_id} href={`/students/${s.student_id}`} className={cardClass}>
                    {body}
                  </Link>
                );
              })}
            </div>

          </>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className={`flex items-center gap-1.5 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              <button
                onClick={() => setPage(Math.max(shownPage - 1, 0))}
                disabled={shownPage === 0}
                aria-label={t('students.prevPage')}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/40 text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40 disabled:hover:bg-transparent">
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>

              {pageWindow(shownPage + 1, totalPages).map((slot, i) =>
                slot === 'gap' ? (
                  <span key={`gap-${i}`} aria-hidden="true"
                    className="w-10 h-10 flex items-end justify-center pb-2 text-on-surface-variant select-none">…</span>
                ) : (
                  <button key={slot}
                    onClick={() => setPage(slot - 1)}
                    aria-current={slot === shownPage + 1 ? 'page' : undefined}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${
                      slot === shownPage + 1
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'border border-outline-variant/40 text-on-surface hover:bg-surface-container'
                    }`}>
                    {slot}
                  </button>
                )
              )}

              <button
                onClick={() => setPage(Math.min(shownPage + 1, totalPages - 1))}
                disabled={shownPage >= totalPages - 1}
                aria-label={t('students.nextPage')}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/40 text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40 disabled:hover:bg-transparent">
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant">
              {t('students.pageOf', { page: shownPage + 1, total: totalPages })}
            </p>
          </div>
        )}
      </div>
      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} />
      {bulkTarget && (
        <BulkDeleteStudentsModal
          ids={bulkTarget.ids}
          previewNames={bulkTarget.names}
          onClose={() => setBulkTarget(null)}
          onDeleted={(deleted, skipped) => {
            setBulkTarget(null);
            exitSelectMode();
            // Step back if this page is now past the end of a shorter roster.
            // The query serves the last page that exists either way; this just
            // avoids a visible jump between the delete and the refetch.
            setPage(clampPage(shownPage, Math.ceil((total - deleted) / PAGE_SIZE)));
            // The server skips ids that were already gone or belong to another
            // branch, so what it deleted can be fewer than what was ticked —
            // and can be none at all. Say which happened rather than printing
            // "Students deleted (0)".
            setNotice(
              deleted === 0
                ? t('students.bulkDeleteNone')
                : `${t('students.bulkDeleteDone')} (${deleted})` +
                  (skipped > 0 ? ` · ${t('students.bulkDeleteSkipped', { n: skipped })}` : '')
            );
          }}
        />
      )}
    </AppShell>
  );
}
