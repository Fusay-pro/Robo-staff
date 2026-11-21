'use client';

// The error log, readable in the app. The owner is one of the two people who
// read it, and the other one needed a terminal, PM2 and a database session to
// answer "why did the delete fail" — which is what this tab exists to replace.
//
// Owner-only, like the delete controls. The API enforces that too, and scopes
// an owner to their own branch.

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import client from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/context/I18nContext';

const PAGE_SIZE = 50;

type StatusFilter = 'all' | '5xx' | '4xx' | 'client';
type DaysFilter = 1 | 7 | 30;

interface LogRow {
  log_id: number;
  occurred_at: string;
  status: number;
  method: string;
  path: string;
  message: string | null;
  stack: string | null;
  user_id: number | null;
  user_name: string | null;
  role: string | null;
  branch_id: number | null;
  request_id: string | null;
}

function statusTone(status: number) {
  if (status === 0)   return 'bg-surface-container-high text-on-surface-variant';   // browser crash
  if (status >= 500)  return 'bg-error/15 text-error';
  return 'bg-orange-100 text-orange-700';
}

function when(iso: string, locale: string) {
  const at = new Date(iso);
  return at.toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function LogsTab() {
  const { t, locale } = useT();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [days, setDays] = useState<DaysFilter>(7);
  const [page, setPage] = useState(0);
  const [openRow, setOpenRow] = useState<number | null>(null);

  const statusParam = status === 'all' ? '' : `&status=${status}`;

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<{
    data: LogRow[]; total: number;
  }>({
    queryKey: ['error-log', status, days, page],
    queryFn: () => {
      // Computed here, not during render: the window has to be relative to
      // when the request goes out, and reading the clock while rendering is
      // neither pure nor stable across re-renders.
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      return client
        .get(`/admin/logs?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&since=${encodeURIComponent(since)}${statusParam}`)
        .then(r => ({ data: r.data?.data ?? [], total: r.data?.total ?? 0 }));
    },
    placeholderData: keepPreviousData,
    // A log of failures that is itself a minute stale is not worth a refetch
    // storm; the Refresh button covers wanting it now.
    staleTime: 30_000,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const shownPage = Math.min(page, totalPages - 1);

  const pick = <T,>(set: (v: T) => void) => (value: T) => { set(value); setPage(0); setOpenRow(null); };

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all',    label: t('logs.filterAll') },
    { key: '5xx',    label: t('logs.filterServer') },
    { key: '4xx',    label: t('logs.filterRefused') },
    { key: 'client', label: t('logs.filterClient') },
  ];
  const DAY_TABS: { key: DaysFilter; label: string }[] = [
    { key: 1,  label: t('logs.last24h') },
    { key: 7,  label: t('logs.last7d') },
    { key: 30, label: t('logs.last30d') },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-surface-container-lowest rounded-xl p-1 border border-outline-variant/20">
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => pick(setStatus)(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                status === tab.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-surface-container-lowest rounded-xl p-1 border border-outline-variant/20">
          {DAY_TABS.map(tab => (
            <button key={tab.key} onClick={() => pick(setDays)(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                days === tab.key ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <button onClick={() => refetch()} disabled={isFetching}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50">
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          {isFetching ? t('logs.refreshing') : t('common.retry')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-surface-container-low animate-pulse rounded-xl" />)}
        </div>
      ) : isError && rows.length === 0 ? (
        // The error viewer failing silently would be its own punchline.
        <div className="py-14 text-center">
          <span className="material-symbols-outlined text-4xl text-error block mb-2">cloud_off</span>
          <p className="font-semibold text-on-surface mb-1">{t('logs.loadFailed')}</p>
          <p className="text-sm text-on-surface-variant mb-4">{errorMessage(error, t('errors.server'))}</p>
          <button onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity">
            {t('common.retry')}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center">
          <span className="material-symbols-outlined text-4xl text-emerald-600 block mb-2">check_circle</span>
          <p className="font-semibold text-on-surface-variant">{t('logs.empty')}</p>
        </div>
      ) : (
        <>
          <div className={`rounded-2xl border border-outline-variant/30 overflow-hidden transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            {rows.map((row, i) => (
              <div key={row.log_id}
                className={`bg-surface-container-lowest ${i > 0 ? 'border-t border-outline-variant/20' : ''}`}>
                <button onClick={() => setOpenRow(openRow === row.log_id ? null : row.log_id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-container transition-colors">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${statusTone(row.status)}`}>
                    {row.status === 0 ? t('logs.clientBadge') : row.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      <span className="font-mono text-xs text-on-surface-variant mr-1.5">{row.method}</span>
                      {row.path}
                    </p>
                    {row.message && (
                      <p className="text-xs text-on-surface-variant mt-0.5 break-words">{row.message}</p>
                    )}
                    <p className="text-[11px] text-on-surface-variant mt-1">
                      {when(row.occurred_at, locale)}
                      {' · '}
                      {row.user_name
                        ? `${row.user_name}${row.role ? ` (${row.role})` : ''}`
                        : row.user_id
                        ? `${t('logs.user')} #${row.user_id}`
                        : t('logs.anonymous')}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                    {openRow === row.log_id ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {openRow === row.log_id && (
                  <div className="px-4 pb-4 pt-1 bg-surface-container-low/40">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                      {t('logs.requestId')}
                    </p>
                    <p className="text-xs font-mono text-on-surface mb-3">{row.request_id || '—'}</p>
                    {row.stack ? (
                      <>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                          {t('logs.stack')}
                        </p>
                        <pre className="text-[11px] font-mono text-on-surface bg-surface-container rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-64">
                          {row.stack}
                        </pre>
                      </>
                    ) : (
                      <p className="text-xs text-on-surface-variant">{t('logs.noStack')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-on-surface-variant">
              {t('logs.rowsTotal', { n: total })}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(shownPage - 1, 0))} disabled={shownPage === 0}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-outline-variant/40 text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <span className="text-xs font-semibold text-on-surface-variant">
                  {t('logs.pageOf', { page: shownPage + 1, total: totalPages })}
                </span>
                <button onClick={() => setPage(Math.min(shownPage + 1, totalPages - 1))} disabled={shownPage >= totalPages - 1}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-outline-variant/40 text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
