'use client';

import AppShell from '@/components/AppShell';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import client from '@/lib/api';
import DateRangePicker from '@/components/DateRangePicker';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import SessionWizardModal  from './_components/SessionWizardModal';
import HolidayWizardModal  from './_components/HolidayWizardModal';
import EditSessionModal    from './_components/EditSessionModal';
import RestoreConfirmModal from './_components/RestoreConfirmModal';
import DeleteConfirmModal  from './_components/DeleteConfirmModal';

// ── constants ──
const CAL_DAYS  = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PAGE_SIZE = 20;
const EMPTY: any[] = [];

// ── helpers ──
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getMondayFirst(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  return first === 0 ? 6 : first - 1;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}
function fmtDisplay(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// ══════════════════════════════════════════════════════
export default function SchedulePage() {
  const { role } = useAuth();
  const { t }    = useT();
  const isOwner  = role === 'owner' || role === 'super_owner';
  const today    = useMemo(() => new Date(), []);
  const [isPending, startTransition] = useTransition();

  // page state
  const [tab, setTab]               = useState<'calendar'|'list'>('list');
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [page, setPage]             = useState(0);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo]     = useState('');
  const [filterCourse, setFilterCourse]     = useState('');
  const [debouncedCourse, setDebouncedCourse] = useState('');

  // modal state
  const [wizOpen, setWizOpen]           = useState(false);
  const [holOpen, setHolOpen]           = useState(false);
  const [editTarget, setEditTarget]     = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [restoreTarget, setRestoreTarget] = useState<any>(null);

  const calYear  = currentDate.getFullYear();
  const calMonth = currentDate.getMonth();
  const firstDay    = getMondayFirst(calYear, calMonth);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // ── queries ──
  const { data: calSessions = [], isLoading: calLoading } = useQuery<any[]>({
    queryKey: ['schedules-month', calYear, calMonth],
    queryFn: () => {
      const from = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
      const to   = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
      return client.get(`/schedules?from=${from}&to=${to}&limit=200`).then(r => r.data?.data ?? []);
    },
    enabled: tab === 'calendar',
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedCourse(filterCourse); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [filterCourse]);
  useEffect(() => { setPage(0); }, [filterFrom, filterTo]);

  const { data: listData, isLoading: listLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ['schedules-list', page, filterFrom, filterTo, debouncedCourse],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo)   params.set('to', filterTo);
      if (debouncedCourse) params.set('course', debouncedCourse);
      return client.get(`/schedules?${params}`).then(r => ({ data: r.data?.data ?? [], total: r.data?.total ?? 0 }));
    },
    enabled: tab === 'list',
    staleTime: 2 * 60 * 1000,
    refetchInterval: 7 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const sessions   = listData?.data ?? EMPTY;
  const total      = listData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const { weekSessions, avgFill, robotTypes } = useMemo(() => {
    const weekSessions = sessions.filter((s: any) => Math.abs(new Date(s.starts_at).getTime() - today.getTime()) / 86400000 <= 7);
    const filled = sessions.filter((s: any) => s.max_capacity > 0);
    const avgFill = filled.length > 0
      ? Math.round(filled.reduce((a: number, s: any) => a + s.enrolled_count / s.max_capacity, 0) / filled.length * 100)
      : 0;
    const robotTypes = new Set(sessions.map((s: any) => s.robot_type_name).filter(Boolean)).size;
    return { weekSessions, avgFill, robotTypes };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: ['holidays'],
    queryFn: () => client.get('/holidays').then(r => r.data),
    enabled: isOwner,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // calendar helpers
  const holidayByDate = useMemo(() => {
    const map: Record<string, any> = {};
    holidays.forEach((h: any) => {
      const start = new Date(h.start_date + 'T00:00:00');
      const end   = new Date(h.end_date   + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        map[toDateStr(d)] = h;
      }
    });
    return map;
  }, [holidays]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    calSessions.forEach((s: any) => {
      const k = toDateStr(new Date(s.starts_at));
      if (!map[k]) map[k] = [];
      map[k].push(s);
    });
    return map;
  }, [calSessions]);
  const selectedSessions = sessionsByDate[selectedDate] ?? [];
  const selectedDateObj  = new Date(selectedDate + 'T00:00:00');

  // Mobile week strip helpers
  const mobileWeekDow   = selectedDateObj.getDay(); // 0=Sun
  const mobileWeekStart = new Date(selectedDateObj);
  mobileWeekStart.setDate(mobileWeekStart.getDate() - (mobileWeekDow === 0 ? 6 : mobileWeekDow - 1));
  const mobileWeekDays  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mobileWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const mobileWeekLabel = `${mobileWeekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${mobileWeekDays[6].toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
  const goMobileWeek = (dir: 1 | -1) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + dir * 7);
    setSelectedDate(toDateStr(d));
  };
  const todayStr = toDateStr(today);

  // ══════════════════════════════════════════════════════
  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 h-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold text-on-surface">{t('schedule.title')}</h2>
            <p className="text-on-surface-variant mt-1 text-xs md:text-sm">Manage and view all sessions.</p>
          </div>
          {isOwner && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setHolOpen(true)}
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-md shadow-orange-500/20">
                <span className="material-symbols-outlined text-[18px]">event_busy</span>
                <span className="hidden sm:inline">{t('schedule.holiday2')}</span>
              </button>
              <button onClick={() => setWizOpen(true)}
                className="flex items-center gap-2 px-3 md:px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-md shadow-primary/20">
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span className="hidden sm:inline">{t('schedule.newSession2')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-outline-variant/30">
          {(['calendar','list'] as const).map(k => (
            <button key={k} onClick={() => startTransition(() => setTab(k))}
              className={`px-5 py-2.5 text-sm font-semibold capitalize transition-all border-b-2 -mb-px ${
                tab === k ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              } ${isPending ? 'opacity-60' : ''}`}>
              {k === 'calendar' ? t('schedule.calendar') : t('schedule.sessionsHeader')}
            </button>
          ))}
        </div>

        {/* ── LIST VIEW ── */}
        {tab === 'list' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30">
                <p className="text-xs font-semibold text-on-surface-variant mb-1">{t('schedule.weeklySessions')}</p>
                <p className="text-3xl font-extrabold text-on-surface">{weekSessions.length}</p>
                <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-emerald-600">trending_up</span>
                  From upcoming schedule
                </p>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30">
                <p className="text-xs font-semibold text-on-surface-variant mb-1">{t('schedule.studentCapacity')}</p>
                <p className="text-3xl font-extrabold text-on-surface">{avgFill}%</p>
                <div className="h-1.5 bg-surface-container rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${avgFill}%` }} />
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30">
                <p className="text-xs font-semibold text-on-surface-variant mb-1">{t('schedule.activeRobotTypes')}</p>
                <p className="text-3xl font-extrabold text-on-surface">{robotTypes}</p>
                <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Systems Operational
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl px-3 py-2 border border-outline-variant/20 shadow-sm">
                <span className="material-symbols-outlined text-on-surface-variant text-[16px]">search</span>
                <input value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                  placeholder="Search course name…"
                  className="bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant w-44" />
                {filterCourse && (
                  <button onClick={() => setFilterCourse('')} className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>
              <DateRangePicker from={filterFrom} to={filterTo}
                onChange={(f, t) => { setFilterFrom(f); setFilterTo(t); }} placeholder="Filter by date range" />
            </div>

            <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/30">
              {listLoading ? (
                <div className="space-y-2 p-6">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-surface-container animate-pulse rounded-xl" />)}
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-16 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl block mb-2">calendar_month</span>
                  No sessions found
                </div>
              ) : (
                <>
                  {/* Mobile cards (< md) */}
                  <div className="md:hidden divide-y divide-outline-variant/15">
                    {sessions.map((s: any) => {
                      const start = new Date(s.starts_at);
                      const fill = s.max_capacity > 0 ? s.enrolled_count / s.max_capacity : 0;
                      const isFull = fill >= 1;
                      return (
                        <div key={s.schedule_id} className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <Link href={`/schedules/${s.schedule_id}`} className="font-bold text-primary hover:underline text-sm leading-tight flex-1 min-w-0">
                              {s.course_name || s.contract_school_name || 'Session'}
                            </Link>
                            {isOwner && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => setEditTarget(s)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-container text-on-surface-variant hover:text-primary transition-colors">
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button onClick={() => setDeleteTarget(s)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-container text-on-surface-variant hover:text-error transition-colors">
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                              {start.toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-2.5">
                            {s.robot_type_name && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                                {s.robot_type_name}
                              </span>
                            )}
                            <div className="flex items-center gap-2 ml-auto">
                              <span className="text-xs font-bold text-on-surface">
                                {s.enrolled_count ?? 0}{s.max_capacity ? `/${s.max_capacity}` : ''}
                              </span>
                              {s.max_capacity > 0 && (
                                <div className="w-14 h-1.5 bg-surface-container rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${isFull ? 'bg-error' : 'bg-primary'}`}
                                    style={{ width: `${Math.min(fill * 100, 100)}%` }} />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table (md+) */}
                  <table className="w-full text-left hidden md:table">
                    <thead>
                      <tr className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant border-b border-outline-variant/30">
                        <th className="px-6 py-4">{t('schedule.colDate')}</th>
                        <th className="px-6 py-4">{t('schedule.colTime')}</th>
                        <th className="px-6 py-4">{t('schedule.colCourse')}</th>
                        <th className="px-6 py-4">{t('schedule.colRobot')}</th>
                        <th className="px-6 py-4">{t('schedule.colEnrolled')}</th>
                        {isOwner && <th className="px-6 py-4 text-right">{t('schedule.colActions')}</th>}
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-outline-variant/15">
                      {sessions.map((s: any) => {
                        const start = new Date(s.starts_at);
                        const fill  = s.max_capacity > 0 ? s.enrolled_count / s.max_capacity : 0;
                        const isFull = fill >= 1;
                        return (
                          <tr key={s.schedule_id} className="hover:bg-surface-container-low/60 transition-colors">
                            <td className="px-6 py-4 text-on-surface">
                              {start.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-on-surface-variant font-medium">
                              {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
                            </td>
                            <td className="px-6 py-4">
                              <Link href={`/schedules/${s.schedule_id}`}
                                className="font-semibold text-primary hover:underline block">
                                {s.course_name || s.contract_school_name || 'Session'}
                              </Link>
                            </td>
                            <td className="px-6 py-4">
                              {s.robot_type_name && (
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                                  {s.robot_type_name}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-on-surface">
                                  {s.enrolled_count ?? 0}{s.max_capacity ? `/${s.max_capacity}` : ''}
                                </span>
                                {s.max_capacity > 0 && (
                                  <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${isFull ? 'bg-error' : 'bg-primary'}`}
                                      style={{ width: `${Math.min(fill * 100, 100)}%` }} />
                                  </div>
                                )}
                              </div>
                            </td>
                            {isOwner && (
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setEditTarget(s)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                  </button>
                                  <button onClick={() => setDeleteTarget(s)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 md:px-6 py-4 border-t border-outline-variant/20 flex items-center justify-between">
                    <p className="text-xs text-on-surface-variant">
                      Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} sessions
                    </p>
                    <div className="flex gap-2">
                      <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors disabled:opacity-40">
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                      </button>
                      <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors disabled:opacity-40">
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Holidays panel ── */}
            {isOwner && holidays.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-orange-500 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                  <h3 className="font-bold text-on-surface">{t('schedule.activeHolidays')}</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">{holidays.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {holidays.map((h: any) => (
                    <div key={h.holiday_id} className="bg-surface-container-lowest rounded-2xl p-4 border border-orange-200 shadow-sm flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-orange-500 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface text-sm">{h.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {fmtDisplay(h.start_date)}{h.start_date !== h.end_date ? ` → ${fmtDisplay(h.end_date)}` : ''}
                        </p>
                        <p className="text-[11px] text-orange-600 font-semibold mt-1">
                          {h.cancelled_count} session{h.cancelled_count !== 1 ? 's' : ''} cancelled
                        </p>
                      </div>
                      <button onClick={() => setRestoreTarget(h)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-200">
                        <span className="material-symbols-outlined text-[14px]">restore</span>
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CALENDAR VIEW ── */}
        {tab === 'calendar' && (
          <>
            {/* Mobile week strip + sessions */}
            <div className="md:hidden space-y-4">
              <div className="bg-surface-container-low rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => goMobileWeek(-1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-on-surface-variant">chevron_left</span>
                  </button>
                  <div className="text-center">
                    <p className="text-xs font-bold text-on-surface">{mobileWeekLabel}</p>
                    <p className="text-[10px] text-on-surface-variant">{mobileWeekStart.getFullYear()}</p>
                  </div>
                  <button onClick={() => goMobileWeek(1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {mobileWeekDays.map(d => {
                    const ds = toDateStr(d);
                    const isToday    = ds === todayStr;
                    const isSelected = ds === selectedDate;
                    const hasSessions = (sessionsByDate[ds] ?? []).length > 0;
                    const holiday = holidayByDate[ds];
                    return (
                      <button key={ds} onClick={() => setSelectedDate(ds)}
                        className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-primary text-white shadow-md shadow-primary/25'
                            : holiday
                            ? 'bg-orange-100 text-orange-800'
                            : isToday
                            ? 'bg-primary/10 text-primary'
                            : 'text-on-surface hover:bg-surface-container'
                        }`}>
                        <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">
                          {['M','T','W','T','F','S','S'][d.getDay() === 0 ? 6 : d.getDay() - 1]}
                        </span>
                        <span className="text-sm font-bold leading-none mt-0.5">{d.getDate()}</span>
                        {hasSessions && (
                          <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white/70' : holiday ? 'bg-orange-500' : 'bg-primary'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-4">
                <p className="text-sm font-semibold text-primary mb-3">
                  {selectedDateObj.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
                {calLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : selectedSessions.length === 0 ? (
                  <div className="text-center text-on-surface-variant py-6">
                    <span className="material-symbols-outlined text-3xl block mb-1">event_busy</span>
                    <p className="text-sm">{t('schedule.noSessionsOnDay')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedSessions.map((s: any) => (
                      <Link key={s.schedule_id} href={`/schedules/${s.schedule_id}`}
                        className="block bg-background rounded-xl p-3 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="font-semibold text-on-surface text-sm group-hover:text-primary transition-colors flex-1 min-w-0">
                            {s.course_name || s.contract_school_name || 'Session'}
                          </p>
                          {s.enrolled_count != null && (
                            <span className="text-xs text-on-surface-variant shrink-0 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">group</span>
                              {s.enrolled_count}{s.max_capacity ? `/${s.max_capacity}` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop: full month grid + sessions panel */}
            <div className="hidden md:grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-surface-container-low rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-on-surface">{MONTHS[calMonth]} {calYear}</h3>
                  <p className="text-sm text-on-surface-variant mt-0.5">{t('schedule.monthlyOverview')}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Prev year */}
                  <button onClick={() => setCurrentDate(new Date(calYear - 1, calMonth, 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors" title={String(calYear - 1)}>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">keyboard_double_arrow_left</span>
                  </button>
                  <button onClick={() => setCurrentDate(new Date(calYear, calMonth - 1, 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-on-surface-variant">chevron_left</span>
                  </button>
                  <button onClick={() => { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(toDateStr(today)); }}
                    className="px-3 py-1.5 bg-surface-container rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors">
                    Today
                  </button>
                  <button onClick={() => setCurrentDate(new Date(calYear, calMonth + 1, 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                  </button>
                  {/* Next year */}
                  <button onClick={() => setCurrentDate(new Date(calYear + 1, calMonth, 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors" title={String(calYear + 1)}>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">keyboard_double_arrow_right</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 mb-2">
                {CAL_DAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-on-surface-variant py-2 tracking-wider">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_,i) => (
                  <div key={`e${i}`} className="h-16 rounded-xl bg-surface-container/30 opacity-40" />
                ))}
                {Array.from({ length: daysInMonth }).map((_,i) => {
                  const day = i + 1;
                  const dateStr = toDateStr(new Date(calYear, calMonth, day));
                  const isToday    = dateStr === toDateStr(today);
                  const isSelected = dateStr === selectedDate;
                  const daySessions = sessionsByDate[dateStr] ?? [];
                  const holiday    = holidayByDate[dateStr];
                  return (
                    <button key={day} onClick={() => setSelectedDate(dateStr)}
                      title={holiday ? holiday.name : undefined}
                      className={`relative h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all
                        ${isSelected
                          ? `bg-primary text-white ring-4 ring-primary/20 scale-105 shadow-lg shadow-primary/25 ${holiday ? 'ring-orange-300' : ''}`
                          : holiday ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                          : isToday ? 'bg-primary/10 text-primary font-bold'
                          : 'hover:bg-surface-container text-on-surface'}`}>
                      {holiday && !isSelected && (
                        <span className="material-symbols-outlined absolute top-1 right-1 text-orange-500 text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          event_busy
                        </span>
                      )}
                      <span className="text-sm font-semibold leading-none">{day}</span>
                      {daySessions.length > 0 && (
                        <div className={`flex gap-0.5 mt-0.5 ${isSelected ? 'opacity-70' : ''}`}>
                          {daySessions.slice(0,3).map((_,j) => (
                            <div key={j} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : holiday ? 'bg-orange-500' : 'bg-primary'}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2 bg-surface-container-low rounded-3xl p-6 flex flex-col">
              <h3 className="font-bold text-lg text-on-surface mb-1">{t('schedule.sessionsHeader')}</h3>
              <p className="text-sm font-semibold text-primary mb-5">
                {selectedDateObj.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
              {calLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : selectedSessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant py-8">
                  <span className="material-symbols-outlined text-4xl block mb-2">event_busy</span>
                  <p className="text-sm">{t('schedule.noSessionsOnDay')}</p>
                </div>
              ) : (
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {selectedSessions.map((s: any) => (
                    <Link key={s.schedule_id} href={`/schedules/${s.schedule_id}`}
                      className="block bg-background rounded-2xl p-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                      <div className="flex items-start justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {s.schedule_type === 'contract_school' ? 'School' : 'Session'}
                        </span>
                        {s.enrolled_count != null && (
                          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                            <span className="material-symbols-outlined text-[13px]">group</span>
                            {s.enrolled_count}{s.max_capacity ? `/${s.max_capacity}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-on-surface text-sm group-hover:text-primary transition-colors">
                        {s.course_name || s.contract_school_name || 'Session'}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>

      {wizOpen && <SessionWizardModal isOwner={isOwner} onClose={() => setWizOpen(false)} />}
      {holOpen && <HolidayWizardModal onClose={() => setHolOpen(false)} />}
      <EditSessionModal key={editTarget?.schedule_id} target={editTarget} isOwner={isOwner} onClose={() => setEditTarget(null)} />
      <RestoreConfirmModal key={restoreTarget?.holiday_id} target={restoreTarget} onClose={() => setRestoreTarget(null)} />
      <DeleteConfirmModal key={deleteTarget?.schedule_id} target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </AppShell>
  );
}
