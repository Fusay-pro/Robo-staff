'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

const CAL_DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const STEP_LABELS = ['Session Info', 'Date & Time', 'Recurrence', 'Confirm'];

type Recurrence = 'once' | 'weekly' | 'biweekly' | 'monthly';
type EndType    = 'count' | 'date';

interface WizardForm {
  courseName: string; courseId: number | null; notes: string;
  date: string; startTime: string; endTime: string; maxCapacity: string;
  teacherUserId: number | null;
  recurrence: Recurrence; recurrenceDays: number[];
  endType: EndType; endDate: string; sessionCount: string;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getMondayFirst(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  return first === 0 ? 6 : first - 1;
}
function fmtDisplay(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function emptyWizard(): WizardForm {
  return {
    courseName: '', courseId: null, notes: '',
    date: toDateStr(new Date()),
    startTime: '09:00', endTime: '10:30', maxCapacity: '',
    teacherUserId: null,
    recurrence: 'once', recurrenceDays: [],
    endType: 'count', endDate: '', sessionCount: '8',
  };
}
function generateDates(f: WizardForm): string[] {
  const start = new Date(f.date + 'T00:00:00');
  if (f.recurrence === 'once') return [f.date];
  const dates: string[] = [];
  const maxN  = f.endType === 'count' ? Math.max(1, parseInt(f.sessionCount) || 1) : 500;
  const endDt = f.endType === 'date' && f.endDate ? new Date(f.endDate + 'T23:59:59') : null;
  if (f.recurrence === 'weekly' || f.recurrence === 'biweekly') {
    const interval = f.recurrence === 'biweekly' ? 14 : 7;
    const days = [...f.recurrenceDays].sort((a, b) => a - b);
    if (!days.length) return [f.date];
    const dow = start.getDay();
    const off = dow === 0 ? -6 : 1 - dow;
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
    let cur = new Date(start), n = 0;
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
  const label   = { weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' }[f.recurrence]!;
  const dayStr  = f.recurrenceDays.map(d => WEEKDAYS[d]).join(', ');
  const first   = fmtDisplay(dates[0]);
  const last    = dates.length > 1 ? fmtDisplay(dates[dates.length - 1]) : '';
  const count   = `${dates.length} session${dates.length !== 1 ? 's' : ''}`;
  const dayPart = f.recurrence !== 'monthly' ? ` on ${dayStr || '—'}` : '';
  return `${label}${dayPart} · ${count} · ${first}${last && last !== first ? ` → ${last}` : ''}`;
}

interface Props {
  onClose:  () => void;
  isOwner:  boolean;
}

export default function SessionWizardModal({ onClose, isOwner }: Props) {
  const { t } = useT();
  const qc = useQueryClient();
  const today = useMemo(() => new Date(), []);

  const [step, setStep]           = useState(1);
  const [wiz, setWiz]             = useState<WizardForm>(emptyWizard);
  const [calYear, setCalYear]     = useState(today.getFullYear());
  const [calMonth, setCalMonth]   = useState(today.getMonth());
  const [courseSearch, setCourseSearch] = useState('');
  const [showDrop, setShowDrop]   = useState(false);
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const setW = (patch: Partial<WizardForm>) => setWiz(w => ({ ...w, ...patch }));
  const toggleDay = (d: number) => setWiz(w => ({
    ...w,
    recurrenceDays: w.recurrenceDays.includes(d) ? w.recurrenceDays.filter(x => x !== d) : [...w.recurrenceDays, d],
  }));

  const { data: courses = [] } = useQuery<any[]>({
    queryKey: ['courses'],
    queryFn: () => client.get('/courses').then(r => r.data),
  });
  const { data: staffList = [] } = useQuery<any[]>({
    queryKey: ['staff-list'],
    queryFn: () => client.get('/users?limit=200').then(r => r.data?.data ?? []),
    enabled: isOwner,
    staleTime: 5 * 60 * 1000,
  });
  const teachers = useMemo(() => staffList.filter((u: any) => u.role === 'staff' || u.role === 'owner'), [staffList]);
  const filteredCourses = useMemo(
    () => courses.filter((c: any) => c.name.toLowerCase().includes(courseSearch.toLowerCase())).slice(0, 8),
    [courses, courseSearch]
  );

  const wizFirstDay    = getMondayFirst(calYear, calMonth);
  const wizDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const createMut = useMutation({
    mutationFn: (body: any) => client.post('/schedules/bulk', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      qc.invalidateQueries({ queryKey: ['schedules-month'] });
    },
  });

  function wizNext() {
    setError('');
    if (step === 1 && !wiz.courseName.trim()) { setError(t('schedule.enterSessionName')); return; }
    if (step === 2) {
      if (!wiz.date) { setError(t('schedule.selectDate')); return; }
      if (!wiz.startTime || !wiz.endTime) { setError(t('schedule.setStartEnd')); return; }
      if (wiz.startTime >= wiz.endTime) { setError('End time must be after start time'); return; }
    }
    if (step === 3 && wiz.recurrence !== 'once' && wiz.recurrence !== 'monthly' && wiz.recurrenceDays.length === 0) {
      setError('Please select at least one day'); return;
    }
    setStep(s => s + 1);
  }

  async function wizSubmit() {
    setError(''); setSubmitting(true);
    const dates = generateDates(wiz);
    try {
      await createMut.mutateAsync({
        course_id:       wiz.courseId ?? undefined,
        teacher_user_id: wiz.teacherUserId ?? undefined,
        max_capacity:    wiz.maxCapacity ? parseInt(wiz.maxCapacity) : undefined,
        notes:           wiz.notes || undefined,
        schedule_type:   'branch',
        force:           true,
        sessions: dates.map(date => ({
          starts_at: `${date}T${wiz.startTime}:00`,
          ends_at:   `${date}T${wiz.endTime}:00`,
        })),
      });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="bg-primary px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Step {step} of 4</p>
              <h3 className="text-xl font-bold text-white">{STEP_LABELS[step - 1]}</h3>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
              <span className="material-symbols-outlined text-white text-[20px]">close</span>
            </button>
          </div>
          <div className="flex gap-1.5">
            {[1,2,3,4].map(s => (
              <div key={s} className={`h-1 rounded-full flex-1 transition-all duration-300 ${s <= step ? 'bg-white' : 'bg-white/25'}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 1: Session Info */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t('schedule.sessionName')}</label>
                <div className="relative" ref={dropRef}>
                  <div className={`flex items-center gap-2 bg-surface-container-low border rounded-xl px-3 py-2.5 transition-all ${showDrop ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/30'}`}>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">school</span>
                    <input value={courseSearch}
                      onChange={e => { setCourseSearch(e.target.value); setW({ courseName: e.target.value, courseId: null }); setShowDrop(true); }}
                      onFocus={() => setShowDrop(true)}
                      placeholder="Search or type session name…"
                      className="flex-1 bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant" />
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
                          onMouseDown={() => { setCourseSearch(c.name); setW({ courseName: c.name, courseId: c.course_id }); setShowDrop(false); }}
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
                <textarea value={wiz.notes} onChange={e => setW({ notes: e.target.value })}
                  placeholder="Any notes about this session…" rows={3}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
              </div>
            </>
          )}

          {/* Step 2: Date & Time */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">{t('schedule.colDate')}</label>
                <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_left</span>
                      </button>
                      <span className="font-bold text-on-surface text-sm min-w-[120px] text-center">{MONTHS[calMonth]} {calYear}</span>
                      <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCalYear(y => y-1)} className="text-[10px] font-bold text-on-surface-variant hover:text-primary px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors">{calYear-1}</button>
                      <button onClick={() => setCalYear(y => y+1)} className="text-[10px] font-bold text-on-surface-variant hover:text-primary px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors">{calYear+1}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {CAL_DAYS.map(d => <div key={d} className="text-center text-[9px] font-bold text-on-surface-variant py-1 tracking-wider">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: wizFirstDay }).map((_,i) => <div key={`e${i}`} />)}
                    {Array.from({ length: wizDaysInMonth }).map((_,i) => {
                      const day     = i + 1;
                      const dateStr = toDateStr(new Date(calYear, calMonth, day));
                      const isSel   = dateStr === wiz.date;
                      const isTod   = dateStr === toDateStr(today);
                      return (
                        <button key={day} onClick={() => setW({ date: dateStr })}
                          className={`h-8 w-full rounded-lg text-xs font-semibold transition-all ${isSel ? 'bg-primary text-white shadow-md shadow-primary/30' : isTod ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-container text-on-surface'}`}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {wiz.date && <p className="text-xs text-primary font-semibold mt-2 text-center">{fmtDisplay(wiz.date)}</p>}
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
                <select value={wiz.teacherUserId ?? ''} onChange={e => setW({ teacherUserId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                  <option value="">{t('schedule.noTeacher')}</option>
                  {teachers.map((t: any) => (
                    <option key={t.user_id} value={t.user_id}>{t.name} {t.role === 'owner' ? '(Owner)' : ''}</option>
                  ))}
                </select>
                <p className="text-[11px] text-on-surface-variant mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">info</span>
                  Staff only see sessions assigned to them on the Today page.
                </p>
              </div>
            </>
          )}

          {/* Step 3: Recurrence */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">{t('schedule.repeatPattern')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['once','weekly','biweekly','monthly'] as Recurrence[]).map(r => (
                    <button key={r} onClick={() => setW({ recurrence: r })}
                      className={`py-3 px-4 rounded-xl text-left border transition-all ${wiz.recurrence === r ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/40 bg-surface-container-low'}`}>
                      <span className={`block text-sm font-bold ${wiz.recurrence === r ? 'text-white' : 'text-on-surface'}`}>
                        {r === 'once' ? 'One-time' : r === 'weekly' ? 'Weekly' : r === 'biweekly' ? 'Every 2 Weeks' : 'Monthly'}
                      </span>
                      <span className={`block text-[10px] mt-0.5 ${wiz.recurrence === r ? 'text-white/70' : 'text-on-surface-variant'}`}>
                        {r === 'once' ? 'Single session' : r === 'weekly' ? 'Same days each week' : r === 'biweekly' ? 'Every other week' : 'Same date monthly'}
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
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${wiz.recurrenceDays.includes(i) ? 'bg-primary text-white shadow-sm' : 'bg-surface-container-low border border-outline-variant/30 text-on-surface-variant hover:border-primary/40'}`}>
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
                    {(['count','date'] as EndType[]).map(et => (
                      <button key={et} onClick={() => setW({ endType: et })}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${wiz.endType === et ? 'bg-primary text-white border-primary' : 'border-outline-variant/30 text-on-surface-variant bg-surface-container-low hover:border-primary/40'}`}>
                        {et === 'count' ? 'After N sessions' : 'On a date'}
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
                    <input type="date" value={wiz.endDate} min={wiz.date} onChange={e => setW({ endDate: e.target.value })}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  )}
                </div>
              )}

              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1.5">{t('schedule.preview')}</p>
                <p className="text-sm font-semibold text-on-surface">{recurrencePreview(wiz) || '—'}</p>
                {wiz.recurrence !== 'once' && generateDates(wiz).length > 0 && (
                  <p className="text-xs text-on-surface-variant mt-1">{generateDates(wiz).length} sessions will be created</p>
                )}
              </div>
            </>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
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
                    {wiz.courseId && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">link</span>Linked to course
                      </p>
                    )}
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
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">{generateDates(wiz).length} sessions will be created</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 shrink-0 bg-surface">
          <button onClick={step === 1 ? onClose : () => { setStep(s => s-1); setError(''); }}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            {step === 1 ? t('common.cancel') : t('common.back')}
          </button>
          <button onClick={step === 4 ? wizSubmit : wizNext} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
            {submitting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('schedule.creating')}</>
              : step === 4
              ? <><span className="material-symbols-outlined text-[16px]">check</span>{t('schedule.create')}</>
              : <>{t('schedule.nextStep')}<span className="material-symbols-outlined text-[16px]">arrow_forward</span></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
