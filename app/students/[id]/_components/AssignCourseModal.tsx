'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface Props {
  open:      boolean;
  studentId: string;
  onClose:   () => void;
}

export default function AssignCourseModal({ open, studentId, onClose }: Props) {
  const { t } = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState({ course_id: '', class_count: '', price: '', name: '' });
  const [err, setErr]   = useState('');

  const { data: courses = [] } = useQuery<any[]>({
    queryKey: ['courses'],
    queryFn:  () => client.get('/courses').then(r => r.data),
    enabled:  open,
  });

  const mut = useMutation({
    mutationFn: (body: any) => client.post('/customer-packages', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-packages', studentId] });
      qc.invalidateQueries({ queryKey: ['student', studentId] });
      setForm({ course_id: '', class_count: '', price: '', name: '' });
      setErr('');
      onClose();
    },
    onError: (e: any) => setErr(e?.response?.data?.error || t('students.failedSave')),
  });

  function submit() {
    setErr('');
    if (!form.course_id) { setErr('Please select a course'); return; }
    if (!form.class_count || parseInt(form.class_count) < 1) { setErr('Please enter number of classes'); return; }
    if (form.price === '') { setErr('Please enter a price'); return; }
    mut.mutate({
      student_id:  parseInt(studentId),
      course_id:   parseInt(form.course_id),
      class_count: parseInt(form.class_count),
      price:       parseFloat(form.price),
      name:        form.name.trim() || undefined,
    });
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-sm">
        <div className="px-6 pt-5 pb-3 border-b border-outline-variant/20 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface">{t('students.assignCourse')}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{t('students.assignCourseHint')}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('schedule.course')} *</label>
            <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">— select —</option>
              {courses.map((c: any) => <option key={c.course_id} value={c.course_id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('manage.pkg.classCount')} *</label>
              <input type="number" min="1" value={form.class_count}
                onChange={e => setForm(f => ({ ...f, class_count: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('manage.pkg.price')} *</label>
              <input type="number" min="0" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              {t('manage.pkg.name')} <span className="text-on-surface-variant font-normal normal-case tracking-normal">({t('common.optional')})</span>
            </label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={courses.find((c: any) => String(c.course_id) === form.course_id)?.name || ''}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={submit} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('students.creating') : t('common.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
