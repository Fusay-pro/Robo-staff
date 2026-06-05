'use client';
import AppShell from '@/components/AppShell';
import { useState, useEffect, useRef } from 'react';
import { useT } from '@/context/I18nContext';
import DataSyncPanel from '@/components/DataSyncPanel';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
function resolveImg(u: string) {
  if (!u) return '';
  return u.startsWith('http') ? u : `${API_URL}${u}`;
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
type Course    = { course_id: number; name: string; description?: string; level_id?: number; robot_type_id?: number; level_name?: string; robot_type_name?: string };
type Pkg       = { package_id: number; course_id: number; name: string; class_count: number; price: number; course_name?: string };
type RobotType = { robot_type_id: number; name: string };
type Level     = { level_id: number; name: string };
type Student   = { student_id: number; name: string; nickname?: string; classes_remaining: number; approval_status: string };
type CusPkg    = { customer_package_id: number; package_id: number; package_name: string; class_count: number; classes_remaining: number; course_name: string; course_id: number };
type Schedule  = { schedule_id: number; starts_at: string; ends_at: string; course_name?: string; enrolled_count: number; max_capacity: number };
type Announcement = { announcement_id: number; title: string; body?: string; image_url?: string; send_to: string; created_at: string; created_by_name?: string };

// ────────────────────────────────────────────────────────────────────────────
// Courses & Packages Tab
// ────────────────────────────────────────────────────────────────────────────
function CoursesTab() {
  const qc = useQueryClient();
  const [modal, setModal]       = useState<null | { editing?: Course }>(null);
  const [form, setForm]         = useState<Record<string, any>>({});
  const [formErr, setFormErr]   = useState('');
  const [delTarget, setDelTarget] = useState<Course | null>(null);

  const { data: courses    = [] } = useQuery<Course[]>   ({ queryKey: ['courses'],       queryFn: () => client.get('/courses').then(r => r.data) });
  const { data: robotTypes = [] } = useQuery<RobotType[]>({ queryKey: ['robot-types'],   queryFn: () => client.get('/robot-types').then(r => r.data) });
  const { data: levels     = [] } = useQuery<Level[]>    ({ queryKey: ['course-levels'], queryFn: () => client.get('/course-levels').then(r => r.data) });

  const courseMut = useMutation({
    mutationFn: (d: any) => d.course_id ? client.patch(`/courses/${d.course_id}`, d) : client.post('/courses', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); setModal(null); },
    onError:   (e: any) => setFormErr(e.response?.data?.error || 'Failed'),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => client.delete(`/courses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); setDelTarget(null); },
  });

  function openCourse(c?: Course) {
    setFormErr(''); setForm(c ?? {}); setModal({ editing: c });
  }

  function save() {
    setFormErr('');
    courseMut.mutate({ ...form, level_id: form.level_id ? +form.level_id : undefined, robot_type_id: form.robot_type_id ? +form.robot_type_id : undefined });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">{courses.length} course{courses.length !== 1 ? 's' : ''}</p>
        <button onClick={() => openCourse()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[16px]">add</span> New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2">school</span>
          <p className="text-sm">No courses yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map(c => (
            <div key={c.course_id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface text-sm">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {c.robot_type_name && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{c.robot_type_name}</span>}
                  {c.level_name      && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-semibold">{c.level_name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openCourse(c)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors">
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                </button>
                <button onClick={() => setDelTarget(c)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 text-error transition-colors">
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-background rounded-3xl p-6 w-full max-w-md shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-on-surface text-lg">{modal.editing ? 'Edit' : 'New'} Course</h3>
              <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Course Name *</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Description</label>
                <textarea rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Robot Type</label>
                  <select value={form.robot_type_id || ''} onChange={e => setForm(f => ({ ...f, robot_type_id: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">None</option>
                    {robotTypes.map(rt => <option key={rt.robot_type_id} value={rt.robot_type_id}>{rt.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Level</label>
                  <select value={form.level_id || ''} onChange={e => setForm(f => ({ ...f, level_id: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">None</option>
                    {levels.map(l => <option key={l.level_id} value={l.level_id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {formErr && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2 mt-4">{formErr}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Cancel</button>
              <button onClick={save} disabled={courseMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {courseMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative bg-background rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <span className="material-symbols-outlined text-3xl text-error mb-2 block">warning</span>
            <h3 className="font-bold text-on-surface mb-1">Delete course?</h3>
            <p className="text-sm text-on-surface-variant mb-5">{delTarget.name} — this cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">Cancel</button>
              <button onClick={() => delMut.mutate(delTarget.course_id)} disabled={delMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Enroll Student Tab
// ────────────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }); }

function EnrollTab() {
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
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
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

              {/* Group by course */}
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

// ────────────────────────────────────────────────────────────────────────────
// Announcements Tab
// ────────────────────────────────────────────────────────────────────────────
function AnnouncementsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', body: '', image_url: '' });
  const [sendErr, setSendErr] = useState('');
  const [sendOk,  setSendOk]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [delTarget, setDelTarget] = useState<Announcement | null>(null);
  const [viewsTarget, setViewsTarget] = useState<Announcement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: viewsData, isLoading: viewsLoading } = useQuery<any>({
    queryKey: ['announcement-views', viewsTarget?.announcement_id],
    queryFn: () => client.get(`/announcements/${viewsTarget!.announcement_id}/views`).then(r => r.data),
    enabled: !!viewsTarget,
  });

  const { data: history = [] } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn:  () => client.get('/announcements').then(r => r.data),
  });

  const sendMut = useMutation({
    mutationFn: (d: any) => client.post('/announcements', d).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setForm({ title: '', body: '', image_url: '' });
      setSendOk(true);
      setTimeout(() => setSendOk(false), 3000);
    },
    onError: (e: any) => setSendErr(e.response?.data?.error || 'Failed to send'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => client.delete(`/announcements/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['announcements'] }); setDelTarget(null); },
  });

  async function handleFile(file: File) {
    setSendErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await client.post('/announcements/upload-image', fd);
      setForm(f => ({ ...f, image_url: data.url }));
    } catch (e: any) {
      setSendErr(e?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function send() {
    if (!form.title.trim()) return;
    setSendErr('');
    sendMut.mutate({ title: form.title, body: form.body || undefined, image_url: form.image_url || undefined, send_to: 'all' });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Sent history */}
      <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10">
          <h3 className="font-bold text-on-surface">Sent</h3>
        </div>
        {history.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl block mb-2">campaign</span>
            <p className="text-sm">No announcements yet</p>
          </div>
        ) : (
          <div className="p-3 space-y-2 max-h-[520px] overflow-y-auto">
            {history.map(a => (
              <div key={a.announcement_id} className="p-3.5 rounded-2xl bg-surface-container-low">
                <div className="flex items-start gap-3">
                  {a.image_url && (
                    <img src={resolveImg(a.image_url)} alt=""
                      onError={e => (e.currentTarget.style.display = 'none')}
                      className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm leading-tight">{a.title}</p>
                    {a.body && <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{a.body}</p>}
                    <p className="text-[10px] text-on-surface-variant mt-1.5">
                      {new Date(a.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => setViewsTarget(a)}
                      title="Who has seen this"
                      className="w-7 h-7 flex items-center justify-center hover:bg-primary/10 text-on-surface-variant hover:text-primary rounded-lg transition-all">
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                    <button onClick={() => setDelTarget(a)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-error/10 text-on-surface-variant hover:text-error rounded-lg transition-all">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create + settings */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-surface-container-lowest rounded-3xl p-5">
          <h3 className="font-bold text-on-surface mb-4">New Announcement</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. School closure this Friday"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Message</label>
              <textarea rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Additional details…"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Image <span className="normal-case font-normal tracking-normal">(optional)</span></label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

              {form.image_url ? (
                <div className="relative rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/30">
                  <img src={resolveImg(form.image_url)} alt=""
                    onError={e => (e.currentTarget.style.display = 'none')}
                    className="w-full h-40 object-cover" />
                  <button
                    onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                    title="Remove image">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-outline-variant/40 bg-surface-container-low hover:bg-surface-container hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-1.5 disabled:opacity-50">
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-on-surface-variant font-semibold">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant">add_photo_alternate</span>
                      <span className="text-sm font-semibold text-on-surface">Choose image from PC</span>
                      <span className="text-[10px] text-on-surface-variant">PNG / JPG, max 5 MB</span>
                    </>
                  )}
                </button>
              )}

              <details className="mt-2">
                <summary className="text-[11px] text-on-surface-variant cursor-pointer hover:text-on-surface">Or paste a URL</summary>
                <input value={form.image_url.startsWith('http') ? form.image_url : ''}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full mt-2 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </details>
            </div>
            {sendErr && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{sendErr}</p>}
            {sendOk  && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">Announcement sent to all parents!</p>}
            <button onClick={send} disabled={!form.title.trim() || sendMut.isPending}
              className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">send</span>
              {sendMut.isPending ? 'Sending…' : 'Send to All'}
            </button>
          </div>
        </div>

      </div>

      {/* View receipts modal */}
      {viewsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewsTarget(null)} />
          <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Read receipts</p>
                <h3 className="text-lg font-bold text-on-surface leading-tight truncate">{viewsTarget.title}</h3>
              </div>
              <button onClick={() => setViewsTarget(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            {viewsLoading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : viewsData ? (
              <>
                <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total</p>
                    <p className="text-2xl font-extrabold text-on-surface">{viewsData.total}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Seen</p>
                    <p className="text-2xl font-extrabold text-emerald-700">{viewsData.seen_count}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Unseen</p>
                    <p className="text-2xl font-extrabold text-orange-700">{viewsData.unseen_count}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {viewsData.unseen_count > 0 && (
                    <>
                      <div className="px-6 py-2 bg-orange-50 border-b border-orange-100 sticky top-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                          Haven&apos;t seen ({viewsData.unseen_count})
                        </p>
                      </div>
                      {viewsData.unseen.map((p: any) => (
                        <div key={p.user_id} className="px-6 py-3 flex items-center gap-3 border-b border-outline-variant/15">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                            <span className="text-orange-700 text-xs font-bold">{p.name?.[0]?.toUpperCase() ?? '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-on-surface text-sm truncate">{p.name}</p>
                            {p.phone && <p className="text-xs text-on-surface-variant">{p.phone}</p>}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {viewsData.seen_count > 0 && (
                    <>
                      <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-100 sticky top-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          Seen ({viewsData.seen_count})
                        </p>
                      </div>
                      {viewsData.seen.map((p: any) => (
                        <div key={p.user_id} className="px-6 py-3 flex items-center gap-3 border-b border-outline-variant/15">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-emerald-700 text-[14px]">check</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-on-surface text-sm truncate">{p.name}</p>
                            <p className="text-[11px] text-on-surface-variant">
                              {new Date(p.viewed_at).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {viewsData.total === 0 && (
                    <div className="py-10 text-center text-on-surface-variant text-sm">
                      No parents on file for this branch yet.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">delete</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">Delete announcement?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              <span className="font-semibold">{delTarget.title}</span> will be removed.
              {delTarget.image_url?.startsWith('/uploads/') && ' The attached image will also be deleted.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={() => delMut.mutate(delTarget.announcement_id)} disabled={delMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {delMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Staff Tab — owner creates/manages teacher accounts for this branch
// ────────────────────────────────────────────────────────────────────────────
type StaffUser = { user_id: number; name: string; email: string; phone?: string; role: string; monthly_salary?: number; active_from?: string; active_until?: string; created_at: string };

function StaffTab() {
  const qc = useQueryClient();

  const { data: list, isLoading } = useQuery<{ data: StaffUser[]; total: number }>({
    queryKey: ['staff-users'],
    queryFn: () => client.get('/users?limit=200').then(r => r.data),
  });
  const users = list?.data ?? [];

  const [modal, setModal] = useState<null | { editing?: StaffUser }>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'staff' as 'staff' | 'owner',
    monthly_salary: '',
  });
  const [err, setErr] = useState('');
  const [delTarget, setDelTarget] = useState<StaffUser | null>(null);

  const createMut = useMutation({
    mutationFn: (d: any) => client.post('/users', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-users'] }); setModal(null); },
    onError: (e: any) => setErr(e?.response?.data?.error || 'Failed to create'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: any) => client.patch(`/users/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-users'] }); setModal(null); },
    onError: (e: any) => setErr(e?.response?.data?.error || 'Failed to save'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => client.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-users'] }); setDelTarget(null); },
  });

  function openCreate() {
    setForm({ name: '', email: '', phone: '', password: '', role: 'staff', monthly_salary: '' });
    setErr('');
    setModal({});
  }
  function openEdit(u: StaffUser) {
    setForm({
      name:           u.name,
      email:          u.email,
      phone:          u.phone || '',
      password:       '',
      role:           (u.role === 'owner' ? 'owner' : 'staff'),
      monthly_salary: u.monthly_salary != null ? String(u.monthly_salary) : '',
    });
    setErr('');
    setModal({ editing: u });
  }

  function save() {
    setErr('');
    if (!form.name.trim())  { setErr('Name is required'); return; }
    if (modal?.editing) {
      updateMut.mutate({
        id: modal.editing.user_id,
        body: {
          name:           form.name.trim(),
          phone:          form.phone.trim() || undefined,
          monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : undefined,
        },
      });
    } else {
      if (!form.email.trim() || form.password.length < 8) { setErr('Email + password (min 8) required'); return; }
      createMut.mutate({
        name:           form.name.trim(),
        email:          form.email.trim(),
        password:       form.password,
        phone:          form.phone.trim() || undefined,
        role:           form.role,
        monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : undefined,
      });
    }
  }

  const owners = users.filter(u => u.role === 'owner' || u.role === 'super_owner');
  const staff  = users.filter(u => u.role === 'staff');

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">
          {users.length} account{users.length !== 1 ? 's' : ''} at this branch
        </p>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[16px]">person_add</span> Add Staff
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-surface-container-low animate-pulse rounded-2xl" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2">group</span>
          <p className="font-semibold text-on-surface">No staff yet</p>
          <p className="text-xs mt-1">Add teachers so they can mark attendance on the Today page.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {owners.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Owners</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {owners.map(u => <StaffCard key={u.user_id} user={u} onEdit={openEdit} onDelete={setDelTarget} />)}
              </div>
            </div>
          )}
          {staff.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Teachers / Staff</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {staff.map(u => <StaffCard key={u.user_id} user={u} onEdit={openEdit} onDelete={setDelTarget} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-md shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface">{modal.editing ? 'Edit Staff' : 'New Staff'}</h3>
              <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Name <span className="text-error">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kru Pim"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Email {!modal.editing && <span className="text-error">*</span>}
                </label>
                <input type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="staff@example.com"
                  disabled={!!modal.editing}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="081-234-5678"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Salary (THB/mo)</label>
                  <input type="number" min="0" value={form.monthly_salary}
                    onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))}
                    placeholder="25000"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              {!modal.editing && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['staff','owner'] as const).map(r => (
                        <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                            form.role === r ? 'bg-primary text-white border-primary' : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-primary/40'
                          }`}>
                          {r === 'staff' ? 'Teacher (Staff)' : 'Co-Owner'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-1.5">
                      Co-owners can create other staff & edit branch info. Teachers can only mark attendance.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Initial Password <span className="text-error">*</span></label>
                    <input type="password" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min 8 characters"
                      minLength={8}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <p className="text-[11px] text-on-surface-variant mt-1.5">Share this with them — they can change it later via Settings.</p>
                  </div>
                </>
              )}

              {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={createMut.isPending || updateMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {createMut.isPending || updateMut.isPending ? 'Saving…' : modal.editing ? 'Save Changes' : 'Create Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">person_remove</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">Remove staff?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              <span className="font-semibold text-on-surface">{delTarget.name}</span> will lose access. Their attendance history stays intact.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteMut.mutate(delTarget.user_id)} disabled={deleteMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {deleteMut.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StaffCard({ user, onEdit, onDelete }: { user: StaffUser; onEdit: (u: StaffUser) => void; onDelete: (u: StaffUser) => void }) {
  const initials = user.name?.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  const isOwner = user.role === 'owner' || user.role === 'super_owner';
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-sm truncate">{user.name}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{user.email}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase ${
          isOwner ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
        }`}>
          {user.role}
        </span>
      </div>
      <div className="text-[11px] text-on-surface-variant grid grid-cols-2 gap-1">
        {user.phone && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">call</span>{user.phone}</span>}
        {user.monthly_salary != null && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">payments</span>฿{user.monthly_salary.toLocaleString?.()}</span>}
      </div>
      <div className="flex gap-2 mt-1">
        <button onClick={() => onEdit(user)}
          className="flex-1 py-1.5 rounded-lg bg-surface-container text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[14px]">edit</span> Edit
        </button>
        <button onClick={() => onDelete(user)}
          className="px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs font-bold hover:bg-error/15 transition-colors">
          <span className="material-symbols-outlined text-[14px]">person_remove</span>
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Settings Tab — Robot Types & Course Levels
// ────────────────────────────────────────────────────────────────────────────
function SettingsTab() {
  const { role } = useAuth();
  const isOwner  = role === 'owner' || role === 'super_owner';
  const qc = useQueryClient();
  const { data: robotTypes = [] } = useQuery<RobotType[]>({ queryKey: ['robot-types'],   queryFn: () => client.get('/robot-types').then(r => r.data) });
  const { data: levels     = [] } = useQuery<Level[]>    ({ queryKey: ['course-levels'], queryFn: () => client.get('/course-levels').then(r => r.data) });

  const [rtModal, setRtModal] = useState<null | { editing?: any }>(null);
  const [rtForm, setRtForm]   = useState<{ name: string; quantity: string }>({ name: '', quantity: '8' });
  const [lvModal, setLvModal] = useState<null | { editing?: any }>(null);
  const [lvForm, setLvForm]   = useState<{ name: string }>({ name: '' });
  const [delTarget, setDelTarget] = useState<null | { kind: 'robot' | 'level'; id: number; name: string }>(null);
  const [threshold, setThreshold] = useState('3');
  const [thresholdSaved, setThresholdSaved] = useState(false);

  const { data: branchSettings } = useQuery<any>({
    queryKey: ['branch-settings'],
    queryFn: () => client.get('/branches/settings').then(r => r.data),
  });

  useEffect(() => {
    if (branchSettings?.low_credit_threshold != null) {
      setThreshold(String(branchSettings.low_credit_threshold));
    }
  }, [branchSettings]);

  // Branch info form
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '' });
  const [branchSaved, setBranchSaved] = useState(false);
  const [branchErr, setBranchErr] = useState('');

  useEffect(() => {
    if (branchSettings?.name != null) {
      setBranchForm({
        name:    branchSettings.name || '',
        address: branchSettings.address || '',
        phone:   branchSettings.phone || '',
      });
    }
  }, [branchSettings]);

  const branchMut = useMutation({
    mutationFn: (d: any) => client.patch('/branches/settings', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-settings'] });
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      setBranchSaved(true);
      setTimeout(() => setBranchSaved(false), 1500);
    },
    onError: (e: any) => setBranchErr(e?.response?.data?.error || 'Failed to save'),
  });
  function saveBranch() {
    setBranchErr('');
    if (!branchForm.name.trim()) { setBranchErr('Name cannot be empty'); return; }
    branchMut.mutate({
      name:    branchForm.name.trim(),
      address: branchForm.address.trim() || undefined,
      phone:   branchForm.phone.trim() || undefined,
    });
  }

  const thresholdMut = useMutation({
    mutationFn: (v: number) => client.patch('/branches/settings', { low_credit_threshold: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-settings'] });
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 1500);
    },
  });

  function saveThreshold() {
    const n = parseInt(threshold);
    if (!isNaN(n) && n >= 1 && n <= 20 && n !== branchSettings?.low_credit_threshold) {
      thresholdMut.mutate(n);
    }
  }

  const rtMut = useMutation({
    mutationFn: (d: any) => d.robot_type_id
      ? client.patch(`/robot-types/${d.robot_type_id}`, { name: d.name, quantity: +d.quantity })
      : client.post('/robot-types', { name: d.name, quantity: +d.quantity }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['robot-types'] }); setRtModal(null); },
  });
  const lvMut = useMutation({
    mutationFn: (d: any) => d.level_id
      ? client.patch(`/course-levels/${d.level_id}`, { name: d.name })
      : client.post('/course-levels', { name: d.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-levels'] }); setLvModal(null); },
  });
  const delRt = useMutation({
    mutationFn: (id: number) => client.delete(`/robot-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['robot-types'] }); setDelTarget(null); },
  });
  const delLv = useMutation({
    mutationFn: (id: number) => client.delete(`/course-levels/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-levels'] }); setDelTarget(null); },
  });

  function openRt(rt?: any) {
    setRtForm(rt ? { name: rt.name, quantity: String(rt.quantity) } : { name: '', quantity: '8' });
    setRtModal({ editing: rt });
  }
  function openLv(lv?: any) {
    setLvForm(lv ? { name: lv.name } : { name: '' });
    setLvModal({ editing: lv });
  }

  return (
    <>
      {/* Branch info — full width */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-primary/5">
          <div>
            <h3 className="font-bold text-on-surface">Branch Info</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">What parents see on their app — name, address, phone</p>
          </div>
          <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Branch Name <span className="text-error">*</span></label>
            <input value={branchForm.name}
              onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Phetkasem 69"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Address</label>
            <input value={branchForm.address}
              onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))}
              placeholder="e.g. 123 Soi Petchkasem 69, Bangkok"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Phone</label>
            <input type="tel" value={branchForm.phone}
              onChange={e => setBranchForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. 02-123-4567"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
            <button onClick={saveBranch} disabled={branchMut.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
              <span className="material-symbols-outlined text-[16px]">save</span>
              {branchMut.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            {branchSaved && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved
              </span>
            )}
            {branchErr && <span className="text-xs text-error">{branchErr}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Robot Types panel */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-primary/5">
            <div>
              <h3 className="font-bold text-on-surface">Robot Types</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Used as default capacity per session</p>
            </div>
            <button onClick={() => openRt()}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90">
              <span className="material-symbols-outlined text-[14px]">add</span> Add
            </button>
          </div>
          {robotTypes.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">No robot types yet.</div>
          ) : (
            <div className="divide-y divide-outline-variant/15">
              {robotTypes.map((rt: any) => (
                <div key={rt.robot_type_id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{rt.name}</p>
                    <p className="text-[11px] text-on-surface-variant">Qty: {rt.quantity}</p>
                  </div>
                  <button onClick={() => openRt(rt)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                  <button onClick={() => setDelTarget({ kind: 'robot', id: rt.robot_type_id, name: rt.name })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course Levels panel */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-primary/5">
            <div>
              <h3 className="font-bold text-on-surface">Course Levels</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Tag courses by skill level (Beginner, Intermediate, …)</p>
            </div>
            <button onClick={() => openLv()}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90">
              <span className="material-symbols-outlined text-[14px]">add</span> Add
            </button>
          </div>
          {levels.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">No levels yet.</div>
          ) : (
            <div className="divide-y divide-outline-variant/15">
              {levels.map((lv: any) => (
                <div key={lv.level_id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>stairs</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{lv.name}</p>
                  </div>
                  <button onClick={() => openLv(lv)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                  <button onClick={() => setDelTarget({ kind: 'level', id: lv.level_id, name: lv.name })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low-Credit Alert panel */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/20 bg-primary/5">
            <h3 className="font-bold text-on-surface">Low-Credit Alert</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Auto-notify parents when a child's classes fall below this threshold.</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-on-surface">Alert when below</span>
              <input type="number" min="1" max="20" value={threshold}
                onChange={e => setThreshold(e.target.value)}
                onBlur={saveThreshold}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-20 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <span className="text-sm text-on-surface-variant">classes</span>
              {thresholdMut.isPending && (
                <span className="text-xs text-on-surface-variant flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              )}
              {thresholdSaved && !thresholdMut.isPending && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Saved
                </span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3">
              Parents get a daily notification when their child has this many classes left or fewer.
            </p>
          </div>
        </div>
      </div>

      {/* Robot Type modal */}
      {rtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRtModal(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface">{rtModal.editing ? 'Edit Robot Type' : 'New Robot Type'}</h3>
              <button onClick={() => setRtModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Name</label>
                <input value={rtForm.name} onChange={e => setRtForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. LEGO SPIKE"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Quantity</label>
                <input type="number" min="1" value={rtForm.quantity} onChange={e => setRtForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <p className="text-[11px] text-on-surface-variant mt-1">Default max capacity for sessions using this robot.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRtModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button
                onClick={() => rtMut.mutate({ ...rtForm, robot_type_id: rtModal.editing?.robot_type_id })}
                disabled={!rtForm.name.trim() || rtMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {rtMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level modal */}
      {lvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLvModal(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface">{lvModal.editing ? 'Edit Level' : 'New Level'}</h3>
              <button onClick={() => setLvModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Name</label>
              <input value={lvForm.name} onChange={e => setLvForm({ name: e.target.value })}
                placeholder="e.g. Beginner"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setLvModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button
                onClick={() => lvMut.mutate({ ...lvForm, level_id: lvModal.editing?.level_id })}
                disabled={!lvForm.name.trim() || lvMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {lvMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">delete</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">Delete {delTarget.kind === 'robot' ? 'Robot Type' : 'Level'}?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              <span className="font-semibold">{delTarget.name}</span> will be removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button
                onClick={() => delTarget.kind === 'robot' ? delRt.mutate(delTarget.id) : delLv.mutate(delTarget.id)}
                disabled={delRt.isPending || delLv.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {(delRt.isPending || delLv.isPending) ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && <DataSyncPanel />}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────
type TabKey = 'courses' | 'enroll' | 'staff' | 'announcements' | 'settings';

export default function ManagePage() {
  const { t } = useT();
  const [tab, setTab] = useState<TabKey>('courses');

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'courses',       label: t('manage.tab.courses'),       icon: 'school' },
    { key: 'enroll',        label: t('manage.tab.enroll'),        icon: 'person_add' },
    { key: 'staff',         label: t('manage.tab.staff'),         icon: 'badge' },
    { key: 'announcements', label: t('manage.tab.announcements'), icon: 'campaign' },
    { key: 'settings',      label: t('manage.tab.settings'),      icon: 'tune' },
  ];

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-on-surface">{t('manage.title')}</h2>
          <p className="text-on-surface-variant mt-1 text-sm">{t('manage.subtitle2')}</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-surface-container rounded-2xl p-1">
          {TABS.map(tab2 => (
            <button key={tab2.key} onClick={() => setTab(tab2.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-bold rounded-xl transition-all ${tab === tab2.key ? 'bg-background text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-[18px]" style={tab === tab2.key ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab2.icon}</span>
              <span className="hidden sm:inline">{tab2.label}</span>
            </button>
          ))}
        </div>

        {tab === 'courses'       && <CoursesTab />}
        {tab === 'enroll'        && <EnrollTab />}
        {tab === 'staff'         && <StaffTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'settings'      && <SettingsTab />}
      </div>
    </AppShell>
  );
}
