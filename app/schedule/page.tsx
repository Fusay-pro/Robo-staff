'use client';

import AppShell from '@/components/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useMemo, useTransition } from 'react';
import Link from 'next/link';
import client from '@/lib/api';
import DateRangePicker from '@/components/DateRangePicker';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';

// ── constants ──
const CAL_DAYS  = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
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

// ── wizard types ──
type Recurrence = 'once' | 'weekly' | 'biweekly' | 'monthly';
type EndType    = 'count' | 'date';

interface WizardForm {
  courseName:    string;
  courseId:      number | null;
  notes:         string;
  date:          string;
  startTime:     string;
  endTime:       string;
  maxCapacity:   string;
  teacherUserId: number | null;
  recurrence:    Recurrence;
  recurrenceDays: number[];
  endType:       EndType;
  endDate:       string;
  sessionCount:  string;
}

const emptyWizard = (): WizardForm => ({
  courseName: '', courseId: null, notes: '',
  date: toDateStr(new Date()),
  startTime: '09:00', endTime: '10:30', maxCapacity: '',
  teacherUserId: null,
  recurrence: 'once', recurrenceDays: [],
  endType: 'count', endDate: '', sessionCount: '8',
});

// ── recurrence logic ──
function generateDates(f: WizardForm): string[] {
  const start = new Date(f.date + 'T00:00:00');
  if (f.recurrence === 'once') return [f.date];

  const dates: string[] = [];
  const maxN   = f.endType === 'count' ? Math.max(1, parseInt(f.sessionCount) || 1) : 500;
  const endDt  = f.endType === 'date' && f.endDate ? new Date(f.endDate + 'T23:59:59') : null;

  if (f.recurrence === 'weekly' || f.recurrence === 'biweekly') {
    const interval = f.recurrence === 'biweekly' ? 14 : 7;
    const days = [...f.recurrenceDays].sort((a, b) => a - b);
    if (!days.length) return [f.date];
    const dow  = start.getDay();
    const off  = dow === 0 ? -6 : 1 - dow;
    const week = new Date(start);
    week.setDate(week.getDate() + off);
    let added = 0;
    outer: while (added < maxN) {
      for (const di of days) {
        const d = new Date(week);
        d.setDate(d.getDate() + di);
        if (d < start) continue;
        if (endDt && d > endDt) break outer;
        dates.push(toDateStr(d));
        if (++added >= maxN) break outer;
      }
      week.setDate(week.getDate() + interval);
    }
  } else {
    const dom = start.getDate();
    let cur = new Date(start);
    let n = 0;
    while (n < maxN) {
      if (endDt && cur > endDt) break;
      dates.push(toDateStr(cur));
      n++;
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, dom);
    }
  }
  return dates;
}

function recurrencePreview(f: WizardForm): string {
  if (f.recurrence === 'once') return f.date ? `One-time · ${fmtDisplay(f.date)}` : '';
  const dates = generateDates(f);
  if (!dates.length) return 'No sessions — pick days above';
  const label  = { weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' }[f.recurrence]!;
  const dayStr = f.recurrenceDays.map(d => WEEKDAYS[d]).join(', ');
  const first  = fmtDisplay(dates[0]);
  const last   = dates.length > 1 ? fmtDisplay(dates[dates.length - 1]) : '';
  const count  = `${dates.length} session${dates.length !== 1 ? 's' : ''}`;
  const dayPart = f.recurrence !== 'monthly' ? ` on ${dayStr || '—'}` : '';
  return `${label}${dayPart} · ${count} · ${first}${last && last !== first ? ` → ${last}` : ''}`;
}

// ── edit form ──
interface EditForm { date: string; start_time: string; end_time: string; max_capacity: string; teacher_user_id: string; }
function toEditForm(s: any): EditForm {
  const st = new Date(s.starts_at), en = new Date(s.ends_at);
  return {
    date: toDateStr(st),
    start_time: `${String(st.getHours()).padStart(2,'0')}:${String(st.getMinutes()).padStart(2,'0')}`,
    end_time:   `${String(en.getHours()).padStart(2,'0')}:${String(en.getMinutes()).padStart(2,'0')}`,
    max_capacity: String(s.max_capacity || ''),
    teacher_user_id: s.teacher_user_id ? String(s.teacher_user_id) : '',
  };
}

// ══════════════════════════════════════════════════════
export default function SchedulePage() {
  const qc       = useQueryClient();
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

  // wizard state
  const [wizOpen, setWizOpen]       = useState(false);
  const [wizStep, setWizStep]       = useState(1);
  const [wiz, setWiz]               = useState<WizardForm>(emptyWizard());
  const [wizCalYear, setWizCalYear] = useState(today.getFullYear());
  const [wizCalMonth, setWizCalMonth] = useState(today.getMonth());
  const [courseSearch, setCourseSearch] = useState('');
  const [showDrop, setShowDrop]     = useState(false);
  const [wizError, setWizError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // edit / delete state
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm]     = useState<EditForm | null>(null);
  const [editError, setEditError]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // holiday wizard state
  const [holOpen, setHolOpen]         = useState(false);
  const [holStep, setHolStep]         = useState(1);
  const [holName, setHolName]         = useState('');
  const [holFrom, setHolFrom]         = useState('');
  const [holTo, setHolTo]             = useState('');
  const [holSelecting, setHolSelecting] = useState<'from'|'to'>('from');
  const [holCalYear, setHolCalYear]   = useState(today.getFullYear());
  const [holCalMonth, setHolCalMonth] = useState(today.getMonth());
  const [holError, setHolError]       = useState('');
  const [holSubmitting, setHolSubmitting] = useState(false);
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

  const { data: courses = [] } = useQuery<any[]>({
    queryKey: ['courses'],
    queryFn: () => client.get('/courses').then(r => r.data),
    enabled: wizOpen,
  });

  const { data: staffList = [] } = useQuery<any[]>({
    queryKey: ['staff-list'],
    queryFn: () => client.get('/users?limit=200').then(r => r.data?.data ?? []),
    enabled: isOwner && (wizOpen || editTarget !== null),
    staleTime: 5 * 60 * 1000,
  });
  const teachers = useMemo(
    () => staffList.filter((u: any) => u.role === 'staff' || u.role === 'owner'),
    [staffList]
  );

  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: ['holidays'],
    queryFn: () => client.get('/holidays').then(r => r.data),
    enabled: isOwner,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: holPreview = [], isFetching: holPreviewing } = useQuery<any[]>({
    queryKey: ['holidays-preview', holFrom, holTo],
    queryFn: () => client.get(`/holidays/preview?from=${holFrom}&to=${holTo}`).then(r => r.data),
    enabled: holStep === 2 && !!holFrom && !!holTo,
  });
  const filteredCourses = useMemo(
    () => courses.filter((c: any) => c.name.toLowerCase().includes(courseSearch.toLowerCase())).slice(0, 8),
    [courses, courseSearch]
  );

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

  // ── mutations ──
  const createMut = useMutation({
    mutationFn: (body: any) => client.post('/schedules', body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules-list'] }); qc.invalidateQueries({ queryKey: ['schedules-month'] }); },
  });
  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => client.patch(`/schedules/${id}`, body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules-list'] }); qc.invalidateQueries({ queryKey: ['schedules-month'] }); setEditTarget(null); },
    onError: (e: any) => setEditError(e.response?.data?.error || t('schedule.failedUpdate')),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => client.delete(`/schedules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules-list'] }); qc.invalidateQueries({ queryKey: ['schedules-month'] }); setDeleteTarget(null); },
  });

  const createHolMut = useMutation({
    mutationFn: (body: any) => client.post('/holidays', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      qc.invalidateQueries({ queryKey: ['schedules-month'] });
      qc.invalidateQueries({ queryKey: ['holidays'] });
      setHolOpen(false); setHolSubmitting(false);
    },
    onError: (e: any) => { setHolError(e?.response?.data?.error || t('schedule.failedCreate')); setHolSubmitting(false); },
  });

  const restoreHolMut = useMutation({
    mutationFn: (id: number) => client.post(`/holidays/${id}/restore`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      qc.invalidateQueries({ queryKey: ['schedules-month'] });
      qc.invalidateQueries({ queryKey: ['holidays'] });
      setRestoreTarget(null);
    },
  });

  // ── wizard helpers ──
  const setW = (patch: Partial<WizardForm>) => setWiz(w => ({ ...w, ...patch }));
  const toggleDay = (d: number) => setWiz(w => ({
    ...w,
    recurrenceDays: w.recurrenceDays.includes(d) ? w.recurrenceDays.filter(x => x !== d) : [...w.recurrenceDays, d],
  }));

  function openWizard() {
    const w = emptyWizard();
    setWiz(w); setWizStep(1); setWizError(''); setWizCalYear(today.getFullYear()); setWizCalMonth(today.getMonth());
    setCourseSearch(''); setShowDrop(false); setSubmitting(false); setWizOpen(true);
  }
  function closeWizard() { setWizOpen(false); setSubmitting(false); }

  function wizNext() {
    setWizError('');
    if (wizStep === 1 && !wiz.courseName.trim()) { setWizError(t('schedule.enterSessionName')); return; }
    if (wizStep === 2) {
      if (!wiz.date) { setWizError(t('schedule.selectDate')); return; }
      if (!wiz.startTime || !wiz.endTime) { setWizError(t('schedule.setStartEnd')); return; }
      if (wiz.startTime >= wiz.endTime) { setWizError('End time must be after start time'); return; }
    }
    if (wizStep === 3 && wiz.recurrence !== 'once' && wiz.recurrence !== 'monthly' && wiz.recurrenceDays.length === 0) {
      setWizError('Please select at least one day'); return;
    }
    setWizStep(s => s + 1);
  }

  async function wizSubmit() {
    setWizError(''); setSubmitting(true);
    const dates = generateDates(wiz);
    try {
      for (const date of dates) {
        await createMut.mutateAsync({
          course_id:       wiz.courseId ?? undefined,
          teacher_user_id: wiz.teacherUserId ?? undefined,
          starts_at:       `${date}T${wiz.startTime}:00`,
          ends_at:         `${date}T${wiz.endTime}:00`,
          max_capacity:    wiz.maxCapacity ? parseInt(wiz.maxCapacity) : undefined,
          notes:           wiz.notes || undefined,
          schedule_type:   'branch',
          force:           true, // override teacher conflicts; surface UI later if needed
        });
      }
      closeWizard();
    } catch (e: any) {
      setWizError(e?.response?.data?.error || 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  }

  // wizard mini calendar
  const wizFirstDay    = getMondayFirst(wizCalYear, wizCalMonth);
  const wizDaysInMonth = new Date(wizCalYear, wizCalMonth + 1, 0).getDate();

  // holiday helpers
  function openHoliday() {
    setHolName(''); setHolFrom(''); setHolTo(''); setHolStep(1);
    setHolSelecting('from'); setHolCalYear(today.getFullYear()); setHolCalMonth(today.getMonth());
    setHolError(''); setHolSubmitting(false); setHolOpen(true);
  }
  function holNext() {
    setHolError('');
    if (holStep === 1) {
      if (!holName.trim()) { setHolError('Please enter a holiday name'); return; }
      if (!holFrom)        { setHolError('Please select a start date'); return; }
      if (!holTo)          { setHolError('Please select an end date'); return; }
    }
    setHolStep(s => s + 1);
  }
  function holCalClick(dateStr: string) {
    if (holSelecting === 'from') {
      setHolFrom(dateStr); setHolTo(''); setHolSelecting('to');
    } else {
      if (dateStr < holFrom) { setHolFrom(dateStr); setHolTo(''); }
      else { setHolTo(dateStr); setHolSelecting('from'); }
    }
  }
  function holSubmit() {
    setHolSubmitting(true); setHolError('');
    createHolMut.mutate({ name: holName, start_date: holFrom, end_date: holTo });
  }

  const holFirstDay    = getMondayFirst(holCalYear, holCalMonth);
  const holDaysInMonth = new Date(holCalYear, holCalMonth + 1, 0).getDate();

  // click outside dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const STEP_LABELS = ['Session Info', 'Date & Time', 'Recurrence', 'Confirm'];

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
              <button onClick={openHoliday}
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-md shadow-orange-500/20">
                <span className="material-symbols-outlined text-[18px]">event_busy</span>
                <span className="hidden sm:inline">{t('schedule.holiday2')}</span>
              </button>
              <button onClick={openWizard}
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
                                <button onClick={() => { setEditTarget(s); setEditForm(toEditForm(s)); setEditError(''); }}
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
                                  <button onClick={() => { setEditTarget(s); setEditForm(toEditForm(s)); setEditError(''); }}
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

      {/* ════════════════════════════════════════
          WIZARD MODAL
      ════════════════════════════════════════ */}
      {wizOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeWizard} />
          <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

            {/* Wizard header */}
            <div className="bg-primary px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Step {wizStep} of 4</p>
                  <h3 className="text-xl font-bold text-white">{STEP_LABELS[wizStep - 1]}</h3>
                </div>
                <button onClick={closeWizard}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
                  <span className="material-symbols-outlined text-white text-[20px]">close</span>
                </button>
              </div>
              <div className="flex gap-1.5">
                {[1,2,3,4].map(s => (
                  <div key={s} className={`h-1 rounded-full flex-1 transition-all duration-300 ${s <= wizStep ? 'bg-white' : 'bg-white/25'}`} />
                ))}
              </div>
            </div>

            {/* Wizard body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* ── STEP 1: Session Info ── */}
              {wizStep === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t('schedule.sessionName')}</label>
                    <div className="relative" ref={dropRef}>
                      <div className={`flex items-center gap-2 bg-surface-container-low border rounded-xl px-3 py-2.5 transition-all ${showDrop ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/30'}`}>
                        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">school</span>
                        <input
                          value={courseSearch}
                          onChange={e => {
                            setCourseSearch(e.target.value);
                            setW({ courseName: e.target.value, courseId: null });
                            setShowDrop(true);
                          }}
                          onFocus={() => setShowDrop(true)}
                          placeholder="Search or type session name…"
                          className="flex-1 bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
                        />
                        {courseSearch && (
                          <button onClick={() => { setCourseSearch(''); setW({ courseName: '', courseId: null }); }}>
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">close</span>
                          </button>
                        )}
                      </div>
                      {showDrop && filteredCourses.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-outline-variant/30 rounded-xl shadow-xl z-20 overflow-hidden">
                          {filteredCourses.map((c: any) => (
                            <button key={c.course_id}
                              onMouseDown={() => {
                                setCourseSearch(c.name);
                                setW({ courseName: c.name, courseId: c.course_id });
                                setShowDrop(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-surface-container flex items-center gap-3 text-sm border-b border-outline-variant/10 last:border-0">
                              <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                              </span>
                              <div>
                                <p className="font-semibold text-on-surface">{c.name}</p>
                                {c.robot_type_name && <p className="text-[11px] text-on-surface-variant">{c.robot_type_name}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {wiz.courseId && (
                      <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                        Linked to existing course
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                      Description <span className="normal-case font-normal tracking-normal">(optional)</span>
                    </label>
                    <textarea
                      value={wiz.notes}
                      onChange={e => setW({ notes: e.target.value })}
                      placeholder="Any notes about this session…"
                      rows={3}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                    />
                  </div>
                </>
              )}

              {/* ── STEP 2: Date & Time ── */}
              {wizStep === 2 && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">{t('schedule.colDate')}</label>
                    <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/20">
                      {/* Month + year nav */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            if (wizCalMonth === 0) { setWizCalMonth(11); setWizCalYear(y => y - 1); }
                            else setWizCalMonth(m => m - 1);
                          }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_left</span>
                          </button>
                          <span className="font-bold text-on-surface text-sm min-w-[120px] text-center">
                            {MONTHS[wizCalMonth]} {wizCalYear}
                          </span>
                          <button onClick={() => {
                            if (wizCalMonth === 11) { setWizCalMonth(0); setWizCalYear(y => y + 1); }
                            else setWizCalMonth(m => m + 1);
                          }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
                          </button>
                        </div>
                        {/* Year jump buttons */}
                        <div className="flex items-center gap-1">
                          <button onClick={() => setWizCalYear(y => y - 1)}
                            className="text-[10px] font-bold text-on-surface-variant hover:text-primary px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors">
                            {wizCalYear - 1}
                          </button>
                          <button onClick={() => setWizCalYear(y => y + 1)}
                            className="text-[10px] font-bold text-on-surface-variant hover:text-primary px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors">
                            {wizCalYear + 1}
                          </button>
                        </div>
                      </div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-1">
                        {CAL_DAYS.map(d => (
                          <div key={d} className="text-center text-[9px] font-bold text-on-surface-variant py-1 tracking-wider">{d}</div>
                        ))}
                      </div>
                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {Array.from({ length: wizFirstDay }).map((_,i) => <div key={`e${i}`} />)}
                        {Array.from({ length: wizDaysInMonth }).map((_,i) => {
                          const day    = i + 1;
                          const dateStr = toDateStr(new Date(wizCalYear, wizCalMonth, day));
                          const isSel  = dateStr === wiz.date;
                          const isTod  = dateStr === toDateStr(today);
                          return (
                            <button key={day} onClick={() => setW({ date: dateStr })}
                              className={`h-8 w-full rounded-lg text-xs font-semibold transition-all ${
                                isSel  ? 'bg-primary text-white shadow-md shadow-primary/30'
                                : isTod ? 'bg-primary/10 text-primary font-bold'
                                : 'hover:bg-surface-container text-on-surface'
                              }`}>
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {wiz.date && (
                      <p className="text-xs text-primary font-semibold mt-2 text-center">{fmtDisplay(wiz.date)}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t('schedule.startTime')}</label>
                      <input type="time" value={wiz.startTime} onChange={e => setW({ startTime: e.target.value })}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t('schedule.endTime')}</label>
                      <input type="time" value={wiz.endTime} onChange={e => setW({ endTime: e.target.value })}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                      Max Capacity <span className="normal-case font-normal tracking-normal text-on-surface-variant">(optional)</span>
                    </label>
                    <input type="number" min="1" value={wiz.maxCapacity} onChange={e => setW({ maxCapacity: e.target.value })}
                      placeholder="Defaults to robot type quantity"
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-on-surface-variant" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                      Assigned Teacher <span className="normal-case font-normal tracking-normal text-on-surface-variant">(optional)</span>
                    </label>
                    <select
                      value={wiz.teacherUserId ?? ''}
                      onChange={e => setW({ teacherUserId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      <option value="">{t('schedule.noTeacher')}</option>
                      {teachers.map((t: any) => (
                        <option key={t.user_id} value={t.user_id}>
                          {t.name} {t.role === 'owner' ? '(Owner)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-on-surface-variant mt-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">info</span>
                      Staff only see sessions assigned to them on the Today page.
                    </p>
                  </div>
                </>
              )}

              {/* ── STEP 3: Recurrence ── */}
              {wizStep === 3 && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">{t('schedule.repeatPattern')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['once','weekly','biweekly','monthly'] as Recurrence[]).map(r => (
                        <button key={r} onClick={() => setW({ recurrence: r })}
                          className={`py-3 px-4 rounded-xl text-left border transition-all ${
                            wiz.recurrence === r
                              ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                              : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/40 bg-surface-container-low'
                          }`}>
                          <span className={`block text-sm font-bold ${wiz.recurrence === r ? 'text-white' : 'text-on-surface'}`}>
                            {r === 'once' ? 'One-time' : r === 'weekly' ? 'Weekly' : r === 'biweekly' ? 'Every 2 Weeks' : 'Monthly'}
                          </span>
                          <span className={`block text-[10px] mt-0.5 ${wiz.recurrence === r ? 'text-white/70' : 'text-on-surface-variant'}`}>
                            {r === 'once' ? 'Single session'
                              : r === 'weekly' ? 'Same days each week'
                              : r === 'biweekly' ? 'Every other week'
                              : 'Same date monthly'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {(wiz.recurrence === 'weekly' || wiz.recurrence === 'biweekly') && (
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">{t('schedule.daysOfWeek')}</label>
                      <div className="flex gap-1.5">
                        {WEEKDAYS.map((d, i) => (
                          <button key={d} onClick={() => toggleDay(i)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                              wiz.recurrenceDays.includes(i)
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-surface-container-low border border-outline-variant/30 text-on-surface-variant hover:border-primary/40'
                            }`}>
                            {d.slice(0, 1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {wiz.recurrence !== 'once' && (
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">{t('schedule.ends')}</label>
                      <div className="flex gap-2 mb-3">
                        {(['count','date'] as EndType[]).map(t => (
                          <button key={t} onClick={() => setW({ endType: t })}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                              wiz.endType === t
                                ? 'bg-primary text-white border-primary'
                                : 'border-outline-variant/30 text-on-surface-variant bg-surface-container-low hover:border-primary/40'
                            }`}>
                            {t === 'count' ? 'After N sessions' : 'On a date'}
                          </button>
                        ))}
                      </div>
                      {wiz.endType === 'count' ? (
                        <div className="flex items-center gap-3">
                          <input type="number" min="1" max="104" value={wiz.sessionCount}
                            onChange={e => setW({ sessionCount: e.target.value })}
                            className="w-24 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          <span className="text-sm text-on-surface-variant">sessions total</span>
                        </div>
                      ) : (
                        <input type="date" value={wiz.endDate} min={wiz.date}
                          onChange={e => setW({ endDate: e.target.value })}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      )}
                    </div>
                  )}

                  {/* Preview */}
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1.5">{t('schedule.preview')}</p>
                    <p className="text-sm font-semibold text-on-surface">{recurrencePreview(wiz) || '—'}</p>
                    {wiz.recurrence !== 'once' && generateDates(wiz).length > 0 && (
                      <p className="text-xs text-on-surface-variant mt-1">
                        {generateDates(wiz).length} sessions will be created
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ── STEP 4: Confirm ── */}
              {wizStep === 4 && (
                <>
                  <p className="text-sm text-on-surface-variant">Review everything before creating.</p>

                  <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/20 divide-y divide-outline-variant/20">
                    <div className="px-4 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('schedule.session')}</p>
                        <p className="font-bold text-on-surface">{wiz.courseName || '—'}</p>
                        {wiz.notes && <p className="text-xs text-on-surface-variant mt-0.5">{wiz.notes}</p>}
                        {wiz.courseId && <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">link</span>Linked to course
                        </p>}
                      </div>
                    </div>
                    <div className="px-4 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('schedule.time')}</p>
                        <p className="font-bold text-on-surface">{wiz.startTime} – {wiz.endTime}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{fmtDisplay(wiz.date)}</p>
                      </div>
                    </div>
                    {wiz.maxCapacity && (
                      <div className="px-4 py-3.5 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('schedule.capacityLabel')}</p>
                          <p className="font-bold text-on-surface">{wiz.maxCapacity} students max</p>
                        </div>
                      </div>
                    )}
                    <div className="px-4 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>repeat</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('schedule.recurrenceLabel')}</p>
                        <p className="font-bold text-on-surface">{recurrencePreview(wiz)}</p>
                        {wiz.recurrence !== 'once' && (
                          <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                            {generateDates(wiz).length} sessions will be created
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              {wizError && (
                <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{wizError}</p>
              )}
            </div>

            {/* Wizard footer */}
            <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 shrink-0 bg-surface">
              <button
                onClick={wizStep === 1 ? closeWizard : () => { setWizStep(s => s - 1); setWizError(''); }}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                {wizStep === 1 ? t('common.cancel') : t('common.back')}
              </button>
              <button
                onClick={wizStep === 4 ? wizSubmit : wizNext}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('schedule.creating')}</>
                  : wizStep === 4
                  ? <><span className="material-symbols-outlined text-[16px]">check</span>{t('schedule.create')}</>
                  : <>{t('schedule.nextStep')}<span className="material-symbols-outlined text-[16px]">arrow_forward</span></>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          HOLIDAY WIZARD MODAL
      ════════════════════════════════════════ */}
      {holOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHolOpen(false)} />
          <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-md flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 shrink-0" style={{ background: '#ea580c' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Step {holStep} of 3</p>
                  <h3 className="text-xl font-bold text-white">
                    {holStep === 1 ? 'Holiday Details' : holStep === 2 ? 'Sessions Affected' : 'Confirm Holiday'}
                  </h3>
                </div>
                <button onClick={() => setHolOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
                  <span className="material-symbols-outlined text-white text-[20px]">close</span>
                </button>
              </div>
              <div className="flex gap-1.5">
                {[1,2,3].map(s => (
                  <div key={s} className={`h-1 rounded-full flex-1 transition-all duration-300 ${s <= holStep ? 'bg-white' : 'bg-white/25'}`} />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── Step 1: Name + date range ── */}
              {holStep === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t('schedule.holidayName')}</label>
                    <input
                      value={holName}
                      onChange={e => setHolName(e.target.value)}
                      placeholder="e.g. Songkran Holiday"
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('schedule.dateRange')}</label>
                      <div className="flex gap-2 text-xs">
                        <button onClick={() => setHolSelecting('from')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${holSelecting === 'from' ? 'bg-orange-500 text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                          From
                        </button>
                        <button onClick={() => setHolSelecting('to')}
                          disabled={!holFrom}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${holSelecting === 'to' ? 'bg-orange-500 text-white' : 'text-on-surface-variant hover:bg-surface-container disabled:opacity-40'}`}>
                          To
                        </button>
                      </div>
                    </div>

                    {(holFrom || holTo) && (
                      <div className="flex gap-2 mb-3 text-xs">
                        <div className={`flex-1 px-3 py-2 rounded-xl border text-center font-semibold ${holFrom ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-outline-variant/30 text-on-surface-variant'}`}>
                          {holFrom ? fmtDisplay(holFrom) : 'Start date'}
                        </div>
                        <span className="self-center text-on-surface-variant">→</span>
                        <div className={`flex-1 px-3 py-2 rounded-xl border text-center font-semibold ${holTo ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-outline-variant/30 text-on-surface-variant'}`}>
                          {holTo ? fmtDisplay(holTo) : 'End date'}
                        </div>
                      </div>
                    )}

                    {/* Mini calendar */}
                    <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { if (holCalMonth === 0) { setHolCalMonth(11); setHolCalYear(y => y-1); } else setHolCalMonth(m => m-1); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_left</span>
                          </button>
                          <span className="font-bold text-on-surface text-sm min-w-[120px] text-center">{MONTHS[holCalMonth]} {holCalYear}</span>
                          <button onClick={() => { if (holCalMonth === 11) { setHolCalMonth(0); setHolCalYear(y => y+1); } else setHolCalMonth(m => m+1); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setHolCalYear(y => y-1)} className="text-[10px] font-bold text-on-surface-variant hover:text-orange-500 px-1.5 py-0.5 rounded hover:bg-orange-50 transition-colors">{holCalYear-1}</button>
                          <button onClick={() => setHolCalYear(y => y+1)} className="text-[10px] font-bold text-on-surface-variant hover:text-orange-500 px-1.5 py-0.5 rounded hover:bg-orange-50 transition-colors">{holCalYear+1}</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 mb-1">
                        {CAL_DAYS.map(d => <div key={d} className="text-center text-[9px] font-bold text-on-surface-variant py-1 tracking-wider">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-0.5">
                        {Array.from({ length: holFirstDay }).map((_,i) => <div key={`e${i}`} />)}
                        {Array.from({ length: holDaysInMonth }).map((_,i) => {
                          const day     = i + 1;
                          const dateStr = toDateStr(new Date(holCalYear, holCalMonth, day));
                          const isFrom  = dateStr === holFrom;
                          const isTo    = dateStr === holTo;
                          const inRange = holFrom && holTo && dateStr > holFrom && dateStr < holTo;
                          const isToday = dateStr === toDateStr(today);
                          return (
                            <button key={day} onClick={() => holCalClick(dateStr)}
                              className={`h-8 w-full rounded-lg text-xs font-semibold transition-all ${
                                isFrom || isTo ? 'bg-orange-500 text-white shadow-sm'
                                : inRange      ? 'bg-orange-100 text-orange-700'
                                : isToday      ? 'bg-primary/10 text-primary font-bold'
                                : 'hover:bg-surface-container text-on-surface'
                              }`}>
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 2: Preview sessions ── */}
              {holStep === 2 && (
                <>
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-1">{t('schedule.holidayPeriod')}</p>
                    <p className="font-bold text-on-surface">{holName}</p>
                    <p className="text-sm text-on-surface-variant">{fmtDisplay(holFrom)} → {fmtDisplay(holTo)}</p>
                  </div>

                  {holPreviewing ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : holPreview.length === 0 ? (
                    <div className="text-center py-8">
                      <span className="material-symbols-outlined text-4xl text-emerald-500 block mb-2">event_available</span>
                      <p className="font-semibold text-on-surface">{t('schedule.noSessionsInPeriod')}</p>
                      <p className="text-xs text-on-surface-variant mt-1">{t('schedule.restorableAnytime')}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-orange-500 text-[18px]">warning</span>
                        <p className="text-sm font-semibold text-on-surface">
                          {holPreview.length} session{holPreview.length !== 1 ? 's' : ''} will be cancelled
                        </p>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {holPreview.map((s: any) => (
                          <div key={s.schedule_id} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5 border border-outline-variant/20">
                            <span className="material-symbols-outlined text-orange-400 text-[16px]">event_busy</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-on-surface truncate">{s.course_name || s.contract_school_name || 'Session'}</p>
                              <p className="text-xs text-on-surface-variant">
                                {new Date(s.starts_at).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── Step 3: Confirm ── */}
              {holStep === 3 && (
                <>
                  <p className="text-sm text-on-surface-variant">All sessions in this period will be soft-cancelled. You can restore them anytime from the Holidays panel.</p>
                  <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/20 divide-y divide-outline-variant/20">
                    <div className="px-4 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-orange-500 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('schedule.holidayLabel')}</p>
                        <p className="font-bold text-on-surface">{holName}</p>
                      </div>
                    </div>
                    <div className="px-4 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-orange-500 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>date_range</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('schedule.periodLabel')}</p>
                        <p className="font-bold text-on-surface">{fmtDisplay(holFrom)}</p>
                        {holFrom !== holTo && <p className="text-sm text-on-surface-variant">→ {fmtDisplay(holTo)}</p>}
                      </div>
                    </div>
                    <div className="px-4 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-orange-500 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('schedule.sessionsToCancel')}</p>
                        <p className="font-bold text-on-surface">{holPreview.length} session{holPreview.length !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-emerald-600 font-semibold mt-0.5">{t('schedule.restorableAnytime')}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {holError && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{holError}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 shrink-0 bg-surface">
              <button
                onClick={holStep === 1 ? () => setHolOpen(false) : () => { setHolStep(s => s-1); setHolError(''); }}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                {holStep === 1 ? t('common.cancel') : t('common.back')}
              </button>
              <button
                onClick={holStep === 3 ? holSubmit : holNext}
                disabled={holSubmitting}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                style={{ background: '#ea580c' }}>
                {holSubmitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('schedule.creating')}</>
                  : holStep === 3
                  ? <><span className="material-symbols-outlined text-[16px]">event_busy</span>{t('schedule.createHoliday')}</>
                  : <>{t('schedule.nextStep')}<span className="material-symbols-outlined text-[16px]">arrow_forward</span></>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESTORE CONFIRM ── */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRestoreTarget(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">restore</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">Restore Sessions?</h3>
            <p className="text-sm text-on-surface-variant mb-2">
              <span className="font-semibold text-on-surface">{restoreTarget.name}</span>
            </p>
            <p className="text-sm text-on-surface-variant mb-6">
              {restoreTarget.cancelled_count} cancelled session{restoreTarget.cancelled_count !== 1 ? 's' : ''} will be restored and the holiday removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRestoreTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={() => restoreHolMut.mutate(restoreTarget.holiday_id)} disabled={restoreHolMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {restoreHolMut.isPending ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editTarget && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-md shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface">{t('schedule.editSession2')}</h3>
              <button onClick={() => setEditTarget(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{t('schedule.colDate')}</label>
                <input type="date" value={editForm.date}
                  onChange={e => setEditForm(f => f ? { ...f, date: e.target.value } : f)}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{t('schedule.startTime')}</label>
                  <input type="time" value={editForm.start_time}
                    onChange={e => setEditForm(f => f ? { ...f, start_time: e.target.value } : f)}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{t('schedule.endTime')}</label>
                  <input type="time" value={editForm.end_time}
                    onChange={e => setEditForm(f => f ? { ...f, end_time: e.target.value } : f)}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Max Capacity <span className="normal-case font-normal tracking-normal">(optional)</span>
                </label>
                <input type="number" min="1" value={editForm.max_capacity}
                  onChange={e => setEditForm(f => f ? { ...f, max_capacity: e.target.value } : f)}
                  placeholder="e.g. 15"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Assigned Teacher <span className="normal-case font-normal tracking-normal">(optional)</span>
                </label>
                <select
                  value={editForm.teacher_user_id}
                  onChange={e => setEditForm(f => f ? { ...f, teacher_user_id: e.target.value } : f)}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">No teacher assigned</option>
                  {teachers.map((t: any) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.name} {t.role === 'owner' ? '(Owner)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {editError && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{editError}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button
                onClick={() => editMut.mutate({
                  id: editTarget.schedule_id,
                  body: {
                    starts_at:       `${editForm.date}T${editForm.start_time}:00`,
                    ends_at:         `${editForm.date}T${editForm.end_time}:00`,
                    max_capacity:    editForm.max_capacity ? parseInt(editForm.max_capacity) : undefined,
                    teacher_user_id: editForm.teacher_user_id ? parseInt(editForm.teacher_user_id) : undefined,
                    force:           true,
                  }
                })}
                disabled={editMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {editMut.isPending ? t('common.saving') : t('dashboard.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">delete</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">{t('schedule.deleteSessionQ')}</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              {t('schedule.deleteSessionMsg', {
                name: deleteTarget.course_name || t('schedule.thisSession'),
                date: (() => { const dt = new Date(deleteTarget.starts_at); return `${dt.getDate()} ${t(`date.monthsShort.${dt.getMonth() + 1}`)}`; })(),
              })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => deleteMut.mutate(deleteTarget.schedule_id)} disabled={deleteMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {deleteMut.isPending ? t('schedule.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
