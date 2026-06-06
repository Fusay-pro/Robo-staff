'use client';
import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface EditForm { date: string; start_time: string; end_time: string; max_capacity: string; teacher_user_id: string; }

function toEditForm(s: any): EditForm {
  const st = new Date(s.starts_at), en = new Date(s.ends_at);
  return {
    date:            `${st.getFullYear()}-${String(st.getMonth()+1).padStart(2,'0')}-${String(st.getDate()).padStart(2,'0')}`,
    start_time:      `${String(st.getHours()).padStart(2,'0')}:${String(st.getMinutes()).padStart(2,'0')}`,
    end_time:        `${String(en.getHours()).padStart(2,'0')}:${String(en.getMinutes()).padStart(2,'0')}`,
    max_capacity:    String(s.max_capacity || ''),
    teacher_user_id: s.teacher_user_id ? String(s.teacher_user_id) : '',
  };
}

interface Props {
  target:  any | null;
  isOwner: boolean;
  onClose: () => void;
}

export default function EditSessionModal({ target, isOwner, onClose }: Props) {
  const { t } = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState<EditForm | null>(null);
  const [err, setErr]   = useState('');

  useEffect(() => {
    if (target) { setForm(toEditForm(target)); setErr(''); }
  }, [target]);

  const { data: staffList = [] } = useQuery<any[]>({
    queryKey: ['staff-list'],
    queryFn:  () => client.get('/users?limit=200').then(r => r.data?.data ?? []),
    enabled:  isOwner && !!target,
    staleTime: 5 * 60 * 1000,
  });
  const teachers = useMemo(
    () => staffList.filter((u: any) => u.role === 'staff' || u.role === 'owner'),
    [staffList]
  );

  const mut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      client.patch(`/schedules/${id}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      qc.invalidateQueries({ queryKey: ['schedules-month'] });
      onClose();
    },
    onError: (e: any) => setErr(e?.response?.data?.error || t('schedule.failedUpdate')),
  });

  if (!target || !form) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl p-6 w-full max-w-md shadow-2xl z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-on-surface">{t('schedule.editSession2')}</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{t('schedule.colDate')}</label>
            <input type="date" value={form.date}
              onChange={e => setForm(f => f ? { ...f, date: e.target.value } : f)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{t('schedule.startTime')}</label>
              <input type="time" value={form.start_time}
                onChange={e => setForm(f => f ? { ...f, start_time: e.target.value } : f)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{t('schedule.endTime')}</label>
              <input type="time" value={form.end_time}
                onChange={e => setForm(f => f ? { ...f, end_time: e.target.value } : f)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Max Capacity <span className="normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <input type="number" min="1" value={form.max_capacity}
              onChange={e => setForm(f => f ? { ...f, max_capacity: e.target.value } : f)}
              placeholder="e.g. 15"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Assigned Teacher <span className="normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <select value={form.teacher_user_id}
              onChange={e => setForm(f => f ? { ...f, teacher_user_id: e.target.value } : f)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">No teacher assigned</option>
              {teachers.map((t: any) => (
                <option key={t.user_id} value={t.user_id}>{t.name} {t.role === 'owner' ? '(Owner)' : ''}</option>
              ))}
            </select>
          </div>
          {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate({
              id:   target.schedule_id,
              body: {
                starts_at:       `${form.date}T${form.start_time}:00`,
                ends_at:         `${form.date}T${form.end_time}:00`,
                max_capacity:    form.max_capacity ? parseInt(form.max_capacity) : undefined,
                teacher_user_id: form.teacher_user_id ? parseInt(form.teacher_user_id) : undefined,
                force:           true,
              },
            })}
            disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('common.saving') : t('dashboard.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
