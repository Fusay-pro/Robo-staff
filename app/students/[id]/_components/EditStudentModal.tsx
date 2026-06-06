'use client';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface Props {
  open:      boolean;
  student:   any;
  studentId: string;
  onClose:   () => void;
}

export default function EditStudentModal({ open, student, studentId, onClose }: Props) {
  const { t } = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', nickname: '', date_of_birth: '', pre_existing_conditions: '',
    branch_id: '', approval_status: 'pending' as 'pending' | 'approved' | 'rejected',
  });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && student) {
      setForm({
        name:                    student.name || '',
        nickname:                student.nickname || '',
        date_of_birth:           student.date_of_birth ? String(student.date_of_birth).slice(0, 10) : '',
        pre_existing_conditions: student.pre_existing_conditions || '',
        branch_id:               String(student.branch_id || ''),
        approval_status:         student.approval_status || 'pending',
      });
      setErr('');
    }
  }, [open, student]);

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn:  () => client.get('/branches').then(r => r.data),
    enabled:  open,
  });

  const mut = useMutation({
    mutationFn: (body: any) => client.patch(`/students/${studentId}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', studentId] });
      qc.invalidateQueries({ queryKey: ['students-list'] });
      onClose();
    },
    onError: (e: any) => setErr(e?.response?.data?.error || t('students.failedSave')),
  });

  function save() {
    setErr('');
    if (!form.name.trim()) { setErr(t('students.nameRequired')); return; }
    mut.mutate({
      name:                    form.name.trim(),
      nickname:                form.nickname.trim() || undefined,
      date_of_birth:           form.date_of_birth || null,
      pre_existing_conditions: form.pre_existing_conditions.trim() || undefined,
      branch_id:               form.branch_id ? parseInt(form.branch_id) : undefined,
      approval_status:         form.approval_status,
    });
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-md flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
        <div className="px-6 pt-5 pb-3 border-b border-outline-variant/20 flex items-center justify-between">
          <h3 className="text-lg font-bold text-on-surface">{t('students.editKid')}</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('common.name')} <span className="text-error">*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.nickname')}</label>
              <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.dob')}</label>
              <input type="date" value={form.date_of_birth}
                onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.medicalNotes')}</label>
            <textarea value={form.pre_existing_conditions}
              onChange={e => setForm(f => ({ ...f, pre_existing_conditions: e.target.value }))}
              rows={3}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.branchLabel')}</label>
              <select value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {branches.map((b: any) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.statusLabel')}</label>
              <select value={form.approval_status}
                onChange={e => setForm(f => ({ ...f, approval_status: e.target.value as any }))}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="pending">{t('students.status.pending')}</option>
                <option value="approved">{t('students.status.approved')}</option>
                <option value="rejected">{t('students.status.rejected')}</option>
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
        </div>

        <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 bg-surface">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={save} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('common.saving') : t('students.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
