'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';
import type { Course, CusPkg, Schedule, Student } from './_types';

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }); }

export default function EnrollTab() {
  const qc = useQueryClient();
  const { t } = useT();
  const [step, setStep]       = useState<1 | 2 | 3>(1);
  const [search, setSearch]   = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [selStudent, setSelStudent] = useState<Student | null>(null);
  const [selPkg,     setSelPkg]     = useState<CusPkg | null>(null);
  const [selSession, setSelSession] = useState<Schedule | null>(null);
  const [enrollErr,  setEnrollErr]  = useState('');
  const [success,    setSuccess]    = useState(false);
  const [buyModal,   setBuyModal]   = useState(false);
  const [buyForm,    setBuyForm]    = useState({ course_id: '', class_count: '', price: '', name: '' });
  const [buyErr,     setBuyErr]     = useState('');

  const { data: allCourses = [] } = useQuery<Course[]>({ queryKey: ['courses'], queryFn: () => client.get('/courses').then(r => r.data), enabled: buyModal });

  useEffect(() => {
    const timer = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: studentsData, isLoading: loadStudents } = useQuery({
    queryKey: ['students-search', debSearch],
    queryFn:  () => client.get(`/students?search=${encodeURIComponent(debSearch)}&limit=30`).then(r => r.data),
    enabled:  step === 1,
  });
  const students: Student[] = studentsData?.data ?? [];

  const { data: cusPkgs = [], isLoading: loadPkgs } = useQuery<CusPkg[]>({
    queryKey: ['customer-packages', selStudent?.student_id],
    queryFn:  () => client.get(`/customer-packages?student_id=${selStudent!.student_id}`).then(r => r.data),
    enabled:  !!selStudent && step === 2,
  });

  const { data: sessionsData, isLoading: loadSessions } = useQuery({
    queryKey: ['schedules-enroll', selPkg?.course_id],
    queryFn:  () => client.get(`/schedules?course_id=${selPkg!.course_id}&limit=30`).then(r => r.data),
    enabled:  !!selPkg && step === 3,
  });
  const sessions: Schedule[] = sessionsData?.data ?? [];

  const buyMut = useMutation({
    mutationFn: (d: any) => client.post('/customer-packages', d).then(r => r.data),
    onSuccess:  (cp) => {
      qc.invalidateQueries({ queryKey: ['customer-packages', selStudent?.student_id] });
      setBuyModal(false);
      setBuyForm({ course_id: '', class_count: '', price: '', name: '' });
      setBuyErr('');
      setSelPkg({ ...cp, course_name: allCourses.find(c => c.course_id === parseInt(buyForm.course_id))?.name ?? '', package_name: buyForm.name || '', class_count: parseInt(buyForm.class_count), classes_remaining: parseInt(buyForm.class_count) });
      setStep(3);
    },
    onError: (e: any) => setBuyErr(e?.response?.data?.error || 'Failed'),
  });

  const enrollMut = useMutation({
    mutationFn: (d: any) => client.post('/enrollments', d).then(r => r.data),
    onSuccess:  () => setSuccess(true),
    onError:    (e: any) => setEnrollErr(e.response?.data?.error || 'Enrollment failed'),
  });

  function reset() {
    setStep(1); setSelStudent(null); setSelPkg(null); setSelSession(null);
    setSearch(''); setDebSearch(''); setEnrollErr(''); setSuccess(false);
    setBuyForm({ course_id: '', class_count: '', price: '', name: '' }); setBuyErr('');
  }

  if (success) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-primary text-3xl">check_circle</span>
      </div>
      <h3 className="font-bold text-on-surface text-lg mb-1">Enrolled!</h3>
      <p className="text-sm text-on-surface-variant mb-1">{selStudent?.name}</p>
      <p className="text-xs text-on-surface-variant mb-2">{selPkg?.course_name}</p>
      {selSession && <p className="text-xs text-on-surface-variant mb-6">{fmtDate(selSession.starts_at)} · {fmtTime(selSession.starts_at)}–{fmtTime(selSession.ends_at)}</p>}
      <button onClick={reset} className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">Enroll Another</button>
    </div>
  );

  return (
    <>
      {/* Step indicator */}
      <div className="flex items-center mb-6">
        {([1, 2, 3] as const).map((s, i) => (
          <div key={s} className="flex items-center">
            {i > 0 && <div className={`w-12 h-px mx-2 ${step > s - 1 ? 'bg-primary' : 'bg-outline-variant/30'}`} />}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s ? 'bg-primary text-white' : step > s ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
              {step > s ? <span className="material-symbols-outlined text-[14px]">check</span> : s}
            </div>
            <span className={`ml-1.5 text-xs font-semibold hidden sm:block ${step >= s ? 'text-on-surface' : 'text-on-surface-variant'}`}>
              {s === 1 ? 'Student' : s === 2 ? 'Package' : 'Session'}
            </span>
          </div>
        ))}
      </div>

      {/* ── Step 1: Pick student ── */}
      {step === 1 && (
        <>
          <div className="flex items-center gap-3 mb-4 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…"
              className="flex-1 bg-transparent text-sm focus:outline-none" />
            {search && <button onClick={() => setSearch('')}><span className="material-symbols-outlined text-[16px] text-on-surface-variant">close</span></button>}
          </div>

          {loadStudents ? (
            <p className="py-12 text-center text-sm text-on-surface-variant">Loading…</p>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl block mb-2">person_search</span>
              <p className="text-sm">{debSearch ? 'No students found' : 'Start typing to search'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {students.map(s => {
                const initials = s.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                const low = typeof s.classes_remaining === 'number' && s.classes_remaining <= 3;
                return (
                  <button key={s.student_id} onClick={() => { setSelStudent(s); setStep(2); }}
                    className="flex flex-col items-center gap-2 p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5 transition-all group">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">{initials}</div>
                    <p className="text-sm font-semibold text-on-surface text-center group-hover:text-primary transition-colors leading-tight">{s.name}</p>
                    {typeof s.classes_remaining === 'number' && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${low ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                        {s.classes_remaining} {t('students.classesLeft')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Step 2: Pick package ── */}
      {step === 2 && selStudent && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => { setStep(1); setSelStudent(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
            </button>
            <div>
              <p className="font-bold text-on-surface">{selStudent.name}</p>
              <p className="text-xs text-on-surface-variant">Select a package</p>
            </div>
          </div>

          {loadPkgs ? (
            <p className="py-12 text-center text-sm text-on-surface-variant">Loading…</p>
          ) : (
            <>
              {cusPkgs.length === 0 && (
                <div className="py-8 text-center text-on-surface-variant mb-4">
                  <span className="material-symbols-outlined text-3xl block mb-2">package_2</span>
                  <p className="text-sm">No active packages — assign one below</p>
                </div>
              )}

              {Object.entries(
                cusPkgs.reduce((acc: Record<string, CusPkg[]>, p) => { (acc[p.course_name] ??= []).push(p); return acc; }, {})
              ).map(([cname, pkgs]) => (
                <div key={cname} className="mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 px-1">{cname}</p>
                  <div className="space-y-2">
                    {pkgs.map(p => {
                      const pct = p.class_count > 0 ? (p.classes_remaining / p.class_count) * 100 : 0;
                      const low = p.classes_remaining <= 3;
                      return (
                        <button key={p.customer_package_id} onClick={() => { setSelPkg(p); setStep(3); }}
                          className="w-full flex items-center gap-4 p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
                          <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px]">package_2</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-on-surface text-sm">{p.package_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden max-w-24">
                                <div className={`h-full rounded-full ${low ? 'bg-error' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${low ? 'text-error' : 'text-on-surface-variant'}`}>{p.classes_remaining}/{p.class_count}</span>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button onClick={() => setBuyModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant/30 text-sm font-bold text-on-surface-variant hover:border-primary/40 hover:text-primary rounded-2xl transition-all">
                <span className="material-symbols-outlined text-[16px]">add</span> Assign New Package
              </button>
            </>
          )}
        </>
      )}

      {/* ── Step 3: Pick session ── */}
      {step === 3 && selPkg && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => { setStep(2); setSelPkg(null); setSelSession(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
            </button>
            <div>
              <p className="font-bold text-on-surface">{selPkg.course_name}</p>
              <p className="text-xs text-on-surface-variant">Pick a session for {selStudent?.name}</p>
            </div>
          </div>

          {loadSessions ? (
            <p className="py-12 text-center text-sm text-on-surface-variant">Loading…</p>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl block mb-2">event_busy</span>
              <p className="text-sm">No upcoming sessions for this course</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {sessions.map(s => {
                const full   = s.max_capacity > 0 && s.enrolled_count >= s.max_capacity;
                const picked = selSession?.schedule_id === s.schedule_id;
                return (
                  <button key={s.schedule_id} onClick={() => !full && setSelSession(s)} disabled={full}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${picked ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : full ? 'border-outline-variant/10 bg-surface-container/50 opacity-50 cursor-not-allowed' : 'border-outline-variant/10 bg-surface-container-lowest hover:border-primary/40 hover:bg-primary/5'}`}>
                    <div className="shrink-0 text-center w-14">
                      <p className="text-[10px] font-bold text-primary">{fmtTime(s.starts_at)}</p>
                      <div className="w-px h-3 bg-outline-variant/30 mx-auto my-0.5" />
                      <p className="text-[10px] text-on-surface-variant">{fmtTime(s.ends_at)}</p>
                    </div>
                    <div className="w-px h-8 bg-outline-variant/20 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-on-surface">{fmtDate(s.starts_at)}</p>
                      {full && <p className="text-xs text-error font-bold mt-0.5">Full</p>}
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${full ? 'text-error' : 'text-on-surface'}`}>{s.enrolled_count}/{s.max_capacity}</p>
                    {picked && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
                  </button>
                );
              })}
            </div>
          )}

          {enrollErr && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2 mb-3">{enrollErr}</p>}

          {selSession && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">{selStudent?.name}</p>
                <p className="text-xs text-on-surface-variant">{fmtDate(selSession.starts_at)} · {fmtTime(selSession.starts_at)}–{fmtTime(selSession.ends_at)}</p>
              </div>
              <button
                onClick={() => enrollMut.mutate({ student_id: selStudent!.student_id, schedule_id: selSession.schedule_id, customer_package_id: selPkg.customer_package_id })}
                disabled={enrollMut.isPending}
                className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                {enrollMut.isPending ? 'Enrolling…' : 'Confirm Enroll'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Assign course modal */}
      {buyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBuyModal(false)} />
          <div className="relative bg-background rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-on-surface text-lg">{t('students.assignCourse')}</h3>
              <button onClick={() => setBuyModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <p className="text-sm text-on-surface-variant mb-4">{selStudent?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('schedule.course')} *</label>
                <select value={buyForm.course_id} onChange={e => setBuyForm(f => ({ ...f, course_id: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">— select —</option>
                  {allCourses.map(c => <option key={c.course_id} value={c.course_id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('manage.pkg.classCount')} *</label>
                  <input type="number" min="1" value={buyForm.class_count} onChange={e => setBuyForm(f => ({ ...f, class_count: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('manage.pkg.price')} *</label>
                  <input type="number" min="0" value={buyForm.price} onChange={e => setBuyForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  {t('manage.pkg.name')} <span className="text-on-surface-variant font-normal normal-case tracking-normal">({t('common.optional')})</span>
                </label>
                <input value={buyForm.name} onChange={e => setBuyForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={allCourses.find(c => String(c.course_id) === buyForm.course_id)?.name || ''}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {buyErr && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{buyErr}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setBuyModal(false)} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">{t('common.cancel')}</button>
              <button
                onClick={() => {
                  if (!buyForm.course_id || !buyForm.class_count || buyForm.price === '') { setBuyErr('Please fill all required fields'); return; }
                  setBuyErr('');
                  buyMut.mutate({ student_id: selStudent!.student_id, course_id: parseInt(buyForm.course_id), class_count: parseInt(buyForm.class_count), price: parseFloat(buyForm.price), name: buyForm.name.trim() || undefined });
                }}
                disabled={buyMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {buyMut.isPending ? t('students.creating') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
