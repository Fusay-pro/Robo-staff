'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import type { Course, RobotType, Level } from './_types';

export default function CoursesTab() {
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
