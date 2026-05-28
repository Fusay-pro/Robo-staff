'use client';
/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */

import AppShell from '@/components/AppShell';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import client from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { useT } from '@/context/I18nContext';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

interface ActivityFeed {
  bookings: Array<{
    enrollment_id: number;
    student_id: number;
    student_name: string;
    parent_name?: string;
    parent_phone?: string;
    status: string;
    created_at: string;
    booking_note?: string;
    schedule_id: number;
    starts_at: string;
    session_name: string;
  }>;
  hotspots: Array<{
    schedule_id: number;
    starts_at: string;
    max_capacity: number;
    enrolled_count: number;
    fill_pct: number;
    session_name: string;
  }>;
  top_kids: Array<{
    student_id: number;
    student_name: string;
    bookings_30d: number;
    last_booked: string;
  }>;
}

export default function ActivityPage() {
  const { t } = useT();

  function fmtRelative(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)          return `${Math.floor(diff)}${t('activity.secAgo')}`;
    if (diff < 3600)        return `${Math.floor(diff / 60)}${t('activity.minAgo')}`;
    if (diff < 86400)       return `${Math.floor(diff / 3600)}${t('activity.hAgo')}`;
    if (diff < 7 * 86400)   return `${Math.floor(diff / 86400)}${t('activity.dAgo')}`;
    const d = new Date(iso);
    return `${d.getDate()} ${t(`date.monthsShort.${d.getMonth() + 1}`)}`;
  }
  function fmtDateTime(iso: string) {
    const d = new Date(iso);
    return `${t(`date.daysShort.${DAY_KEYS[d.getDay()]}`)} ${d.getDate()} ${t(`date.monthsShort.${d.getMonth() + 1}`)} Â· ${d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`;
  }

  const { data, isLoading } = useQuery<ActivityFeed>({
    queryKey: ['activity-feed'],
    queryFn: () => client.get('/schedules/activity').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const bookings = data?.bookings ?? [];
  const hotspots = data?.hotspots ?? [];
  const topKids  = data?.top_kids  ?? [];

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-on-surface">{t('activity.title')}</h2>
            <p className="text-on-surface-variant mt-1 text-xs md:text-sm">{t('activity.subtitleFull')}</p>
          </div>
          <button onClick={() => downloadCsv('bookings-30d', bookings, [
            { key: 'created_at',   label: 'Booked At',   format: (_r: any, v: any) => v ? new Date(v).toLocaleString('en-CA') : '' },
            { key: 'student_name', label: 'Student' },
            { key: 'parent_name',  label: 'Parent' },
            { key: 'parent_phone', label: 'Phone' },
            { key: 'session_name', label: 'Session' },
            { key: 'starts_at',    label: 'Session Date', format: (_r: any, v: any) => v ? new Date(v).toLocaleString('en-CA') : '' },
            { key: 'status',       label: 'Status' },
            { key: 'booking_note', label: 'Note' },
          ])}
          disabled={bookings.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container hover:border-primary/40 transition-colors disabled:opacity-50 shrink-0">
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="hidden sm:inline">{t('activity.exportBookings')}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-96 bg-surface-container-low animate-pulse rounded-3xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Hotspots */}
            <div className="lg:col-span-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant/20 bg-orange-50 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                <h3 className="font-bold text-on-surface">{t('activity.hotspots')}</h3>
                {hotspots.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    {hotspots.length}
                  </span>
                )}
              </div>
              {hotspots.length === 0 ? (
                <div className="py-12 px-6 text-center text-on-surface-variant flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[28px] text-outline">check_circle</span>
                  </div>
                  <p className="font-semibold text-on-surface">{t('activity.allGood')}</p>
                  <p className="text-xs mt-1">{t('activity.noHotspots')}</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/15">
                  {hotspots.map(h => {
                    const isFull = h.fill_pct >= 100;
                    return (
                      <Link key={h.schedule_id} href={`/schedules/${h.schedule_id}`}
                        className="block px-5 py-3.5 hover:bg-surface-container-low/60 transition-colors">
                        <p className="font-semibold text-on-surface text-sm truncate">{h.session_name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{fmtDateTime(h.starts_at)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[11px] font-bold ${isFull ? 'text-error' : 'text-orange-700'}`}>
                            {h.enrolled_count} / {h.max_capacity} ({h.fill_pct}%)
                          </span>
                          <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isFull ? 'bg-error' : 'bg-orange-500'}`}
                              style={{ width: `${Math.min(h.fill_pct, 100)}%` }} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent bookings */}
            <div className="lg:col-span-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant/20 bg-primary/5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
                <h3 className="font-bold text-on-surface">{t('activity.recentBookings')}</h3>
                {bookings.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {bookings.length}
                  </span>
                )}
              </div>
              {bookings.length === 0 ? (
                <div className="py-12 px-6 text-center text-on-surface-variant flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[28px] text-outline">inbox</span>
                  </div>
                  <p className="font-semibold text-on-surface">{t('activity.noBookings')}</p>
                  <p className="text-xs mt-1">{t('activity.noBookingsHint')}</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/15 max-h-[600px] overflow-y-auto">
                  {bookings.map(b => (
                    <Link key={b.enrollment_id} href={`/schedules/${b.schedule_id}`}
                      className="block px-5 py-3.5 hover:bg-surface-container-low/60 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {b.student_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-on-surface text-sm">{b.student_name}</p>
                            {b.status === 'cancelled' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-error/10 text-error">{t('activity.cancelled')}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-on-surface-variant truncate">
                            {t('activity.bookedBy')} {b.parent_name || 'â€”'} Â· <span className="font-bold">{b.session_name}</span>
                          </p>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">
                            {fmtDateTime(b.starts_at)} Â· <span className="text-primary font-semibold">{fmtRelative(b.created_at)}</span>
                          </p>
                          {b.booking_note && (
                            <p className="text-xs text-on-surface mt-1.5 bg-surface-container rounded-lg px-2.5 py-1.5 italic line-clamp-2">
                              &ldquo;{b.booking_note}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Most active kids */}
            <div className="lg:col-span-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant/20 bg-emerald-50 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                <h3 className="font-bold text-on-surface">{t('activity.mostActiveKids')}</h3>
                <span className="ml-auto text-[10px] font-bold text-emerald-700">{t('activity.last30d')}</span>
              </div>
              {topKids.length === 0 ? (
                <div className="py-12 px-6 text-center text-on-surface-variant flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[28px] text-outline">group</span>
                  </div>
                  <p className="font-semibold text-on-surface">{t('activity.noActiveKids')}</p>
                  <p className="text-xs mt-1">{t('activity.noActiveKidsHint')}</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/15">
                  {topKids.map((k, i) => (
                    <Link key={k.student_id} href={`/students/${k.student_id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low/60 transition-colors">
                      <span className="w-6 text-center text-xs font-bold text-on-surface-variant shrink-0">{i + 1}</span>
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {k.student_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface text-sm truncate">{k.student_name}</p>
                        <p className="text-[10px] text-on-surface-variant">{t('activity.lastBooked')}: {fmtRelative(k.last_booked)}</p>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                        {k.bookings_30d} {k.bookings_30d !== 1 ? t('activity.bookings') : t('activity.booking')}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}


