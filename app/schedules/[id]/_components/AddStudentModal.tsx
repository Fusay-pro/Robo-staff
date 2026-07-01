'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';

interface Props {
  scheduleId: string;   // raw route param, so invalidation keys match the detail page
  sessionFull: boolean;
  onClose: () => void;
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AddStudentModal({ scheduleId, sessionFull, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep]         = useState<1 | 2>(1);
  const [search, setSearch]     = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [selStudent, setSelStudent] = useState<any>(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: studentsData, isLoading: loadStudents } = useQuery({
    queryKey: ['students-search', debSearch],
    queryFn:  () => client.get(`/students?search=${encodeURIComponent(debSearch)}&limit=30`).then(r => r.data),
    enabled:  step === 1,
  });
  const students: any[] = studentsData?.data ?? [];

  const { data: cusPkgs = [], isLoading: loadPkgs } = useQuery<any[]>({
    queryKey: ['customer-packages', selStudent?.student_id],
    queryFn:  () => client.get(`/customer-packages?student_id=${selStudent.student_id}`).then(r => r.data),
    enabled:  !!selStudent && step === 2,
  });

  const addMut = useMutation({
    mutationFn: (customerPackageId: number) =>
      client.post('/enrollments', {
        student_id:          selStudent.student_id,
        schedule_id:         Number(scheduleId),
        customer_package_id: customerPackageId,
        force:               true,   // owner add: bypass capacity (package balance still enforced)
      }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', scheduleId] });
      qc.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to add student'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-md flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-outline-variant/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => { setStep(1); setSelStudent(null); setError(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
              </button>
            )}
            <div>
              <h3 className="font-bold text-on-surface text-lg">Add Student</h3>
              <p className="text-xs text-on-surface-variant">{step === 1 ? 'Pick a student' : `Pick a package for ${selStudent?.name}`}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {sessionFull && (
            <div className="mb-4 flex items-start gap-2 text-xs bg-error-container/30 text-on-surface rounded-xl px-3 py-2.5">
              <span className="material-symbols-outlined text-error text-[16px] shrink-0">warning</span>
              <span>This session is already full — adding a student will exceed its capacity.</span>
            </div>
          )}

          {/* Step 1: student search */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-4 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" autoFocus
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
                <div className="space-y-2">
                  {students.map(s => (
                    <button key={s.student_id} onClick={() => { setSelStudent(s); setStep(2); setError(''); }}
                      className="w-full flex items-center gap-3 p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">{initials(s.name)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface">{s.name}</p>
                        {s.parent_name && <p className="text-xs text-on-surface-variant truncate">{s.parent_name}</p>}
                      </div>
                      {typeof s.classes_remaining === 'number' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${s.classes_remaining <= 3 ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                          {s.classes_remaining} left
                        </span>
                      )}
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step 2: package pick */}
          {step === 2 && selStudent && (
            <>
              {loadPkgs ? (
                <p className="py-12 text-center text-sm text-on-surface-variant">Loading…</p>
              ) : cusPkgs.length === 0 ? (
                <div className="py-12 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-3xl block mb-2">package_2</span>
                  <p className="text-sm">No active packages for this student.</p>
                  <p className="text-xs mt-1">Assign a package in Manage → Enroll first.</p>
                </div>
              ) : (
                Object.entries(
                  cusPkgs.reduce((acc: Record<string, any[]>, p) => { (acc[p.course_name] ??= []).push(p); return acc; }, {})
                ).map(([cname, pkgs]) => (
                  <div key={cname} className="mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 px-1">{cname}</p>
                    <div className="space-y-2">
                      {(pkgs as any[]).map(p => {
                        const low = p.classes_remaining <= 3;
                        return (
                          <button key={p.customer_package_id}
                            onClick={() => { setError(''); addMut.mutate(p.customer_package_id); }}
                            disabled={addMut.isPending || p.classes_remaining <= 0}
                            className="w-full flex items-center gap-4 p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed">
                            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[20px]">package_2</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-on-surface text-sm">{p.package_name}</p>
                              <span className={`text-xs font-bold ${low ? 'text-error' : 'text-on-surface-variant'}`}>{p.classes_remaining}/{p.class_count} classes left</span>
                            </div>
                            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">add</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {error && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2 mt-3">{error}</p>}
          {addMut.isPending && <p className="text-xs text-on-surface-variant text-center mt-3">Adding…</p>}
        </div>
      </div>
    </div>
  );
}
